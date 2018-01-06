///////////////////////////////////////////////////////////////////////////
// Copyright 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(['dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/Deferred',
    'dojo/DeferredList',
    'dojo/Evented',
    'dojox/data/CsvStore',
    'dojo/store/Observable',
    'dojo/store/Memory',
    'esri/graphicsUtils',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/Point',
    'esri/layers/FeatureLayer',
    'esri/tasks/locator',
    'esri/tasks/query',
    'esri/SpatialReference',
    'jimu/utils'
],
function (declare, array, lang, Deferred, DeferredList, Evented, CsvStore, Observable, Memory,
  graphicsUtils, webMercatorUtils, Point, FeatureLayer, Locator, Query, SpatialReference,
  jimuUtils) {
  return declare([Evented], {

    //may just move away from the this.useMultiFields alltogether since each source should know what it supports
    //but each source can use either actually...need to really think through this
    //so if they flag single and multi on a single locator...that locator should actually be processed twice
    //once for multi and once for single is what I am thinking

    //When storing address details need to store the locator index that was used to generate a given address in addition to
    // the address so when feature views potentially re-geocode they use the same one

    //TODO need to set this._currentAddressFields for XY fields

    file: null,
    map: null,
    spatialReference: null,
    fsFields: [],
    duplicateTestFields: [], //field names from the layer
    geocodeSources: [],
    duplicateData: [],
    data: null,
    editLayer: null,
    separatorCharacter: null,
    csvStore: null,
    storeItems: null,
    matchedFeatureLayer: null,
    mappedArrayFields: null,
    unMatchedFeatureLayer: null,
    duplicateFeatureLayer: null,
    addrFieldName: "", //double check but I don't think this is necessary anymore
    xFieldName: "",
    yFieldName: "",
    symbol: null,
    matchFieldPrefix: "MatchField_",

    constructor: function (options) {
      lang.mixin(this, options);

      this.useAddr = true;
      //used for new layers that will be constructed...suppose I could just pull the value from the edit layer and not store both...
      this.objectIdField = "ObjectID";
      this.nls = options.nls;

      //find fields flagged to be used in duplicate search
      this._getDuplicateFields(this.fsFields);

      //TODO this is now configurable...need to pull from there
      this.minScore = 90;

      this.spatialReference = this.editLayer.spatialReference;
    },

    _getDuplicateFields: function (fields) {
      var duplicateFieldNames = [];
      array.forEach(fields, function (f) {
        if (f.duplicate) {
          duplicateFieldNames.push(f.name);
        }
      });
      this.duplicateTestFields = duplicateFieldNames;
    },

    handleCsv: function () {
      var def = new Deferred();
      if (this.file && !this.file.data) {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          this.data = reader.result;
          this._processCsvData().then(function (fieldsInfo) {
            def.resolve(fieldsInfo);
          });
        });
        reader.readAsText(this.file);
      }
      return def;
    },

    _processCsvData: function () {
      var def = new Deferred();
      this._convertSources();
      this._getSeparator();
      this._getCsvStore().then(function (fieldsInfo) {
        def.resolve(fieldsInfo);
      });
      return def;
    },

    /*jshint loopfunc:true */
    processForm: function () {
      var def = new Deferred();
      this._locateData(this.useAddr).then(lang.hitch(this, function (data) {
        //var results = {};
        var matchedFeatures = [];
        var unmatchedFeatures = [];
        var duplicateFeatures = [];
        var duplicateLookupList = {};
        var unmatchedI = 0;
        var duplicateI = 0;
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
          var attributes = {};
          var di = data[keys[i]];
          var si = this.storeItems[di.csvIndex];
          array.forEach(this.fsFields, lang.hitch(this, function (f) {
            if (this.mappedArrayFields.hasOwnProperty(f.name)) {
              if (this.mappedArrayFields[f.name]) {
                attributes[f.name] = this.csvStore.getValue(si, this.mappedArrayFields[f.name]);
              } else {
                attributes[f.name] = undefined;
              }
            }
          }));

          //These need to be persisted to support additional locate operations but need to be avoided when going into theactual layer
          array.forEach(this._currentAddressFields, lang.hitch(this, function (f) {
            if (typeof (f.value) !== 'undefined') {
              attributes[this.matchFieldPrefix + f.keyField] = this.csvStore.getValue(si, f.value);
            } else {
              attributes[this.matchFieldPrefix + f.keyField] = undefined;
            }
          }));

          if (di && di.score > this.minScore) {
            attributes.ObjectID = i - unmatchedI - duplicateI;
            attributes.matchScore = di.score;
            matchedFeatures.push({
              "geometry": di.location,
              "attributes": lang.clone(attributes)
            });
          } else if (di.isDuplicate) {
            attributes.ObjectID = duplicateI;
            attributes.DestinationOID = di.featureAttributes[this.editLayer.objectIdField];
            attributes.matchScore = 100;
            attributes.hasDuplicateUpdates = false;
            attributes.duplicateState = 'no-change';
            duplicateFeatures.push({
              "geometry": di.location,
              "attributes": lang.clone(attributes)
            });
            duplicateLookupList[duplicateI] = di.featureAttributes;
            duplicateI++;
          } else {
            attributes.ObjectID = unmatchedI;
            attributes.matchScore = di.score ? di.score : 0;
            //need to handle the null location by doing something
            // not actually sure if this is the best way...may not store the geom...
            unmatchedFeatures.push({
              "geometry": di.location && di.location.type ? di.location : new Point(0, 0, this.spatialReference),
              "attributes": lang.clone(attributes)
            });
            unmatchedI++;
          }
        }

        //This layer will always be created to support save of unmatched or duplicate even when none are matched up front
        this.matchedFeatureLayer = this._initLayer(matchedFeatures, this.file.name);
        if (matchedFeatures.length > 0) {
          //feature list should support zoom to its children
          this._zoomToData(this.matchedFeatureLayer.graphics);
        }

        if (duplicateFeatures.length > 0) {
          this.duplicateFeatureLayer = this._initLayer(duplicateFeatures, this.file.name + "_Duplicate");
        }

        if (unmatchedFeatures.length > 0) {
          this.unMatchedFeatureLayer = this._initLayer(unmatchedFeatures, this.file.name += "_UnMatched");
        }

        def.resolve({
          matchedLayer: this.matchedFeatureLayer,
          unMatchedLayer: this.unMatchedFeatureLayer,
          duplicateLayer: this.duplicateFeatureLayer,
          duplicateLookupList: duplicateLookupList
        });

      }));
      return def;
    },

    _initLayer: function (features, id) {
      var fc = this._generateFC(features);
      var lyr = new FeatureLayer(fc, {
        id: id,
        editable: true,
        outFields: ["*"]
      });
      this.map.addLayers([lyr]);
      return lyr;
    },

    _findDuplicates: function () {
      var def = new Deferred();
      this._getAllLayerFeatures(this.editLayer, this.fsFields).then(lang.hitch(this, function (layerFeatures) {
        this.keys = Object.keys(this.mappedArrayFields);
        this.oidField = this.editLayer.objectIdField;

        //recursive function for testing for duplicate attribute values
        var _testFieldValues = lang.hitch(this, function (testFeatures, index) {
          var def = new Deferred();
          var matchValues = [];
          if (this.keys && index < this.keys.length) {
            var layerFieldName = this.keys[index];
            if (layerFieldName === this.oidField || this.duplicateTestFields.indexOf(layerFieldName) === -1) {
              index += 1;
              _testFieldValues(testFeatures, index).then(lang.hitch(this, function (results) {
                def.resolve(results);
              }));
            } else {
              var fileFieldName = this.mappedArrayFields[layerFieldName];
              if (fileFieldName) {
                for (var ii = 0; ii < this.storeItems.length; ii++) {
                  var item = this.storeItems[ii];
                  var fileValue = this.csvStore.getValue(item, fileFieldName);
                  var fileId = item._csvId;
                  array.forEach(testFeatures, function (feature) {
                    //first time trough features will be from layer query...additional times through they will
                    // be from our result object
                    var _feature = feature.attributes ? feature : feature.feature;
                    var featureValue = _feature.attributes[layerFieldName];
                    if (fileValue === featureValue) {
                      matchValues.push({
                        feature: _feature,
                        featureId: _feature.attributes[this.oidField],
                        fileId: fileId
                      });
                    }
                  });
                }
              }

              if (matchValues.length > 0) {
                index += 1;
                _testFieldValues(matchValues, index).then(lang.hitch(this, function (results) {
                  def.resolve(results);
                }));
              } else {
                def.resolve(matchValues);
                return def.promise;
              }
            }
          } else {
            def.resolve(testFeatures);
          }

          return def;
        });

        //make the inital call to test fields if the layer has features
        if (layerFeatures.length > 0) {
          _testFieldValues(layerFeatures, 0).then(lang.hitch(this, function (results) {
            //pass the results so the locate function will know what ones to skip
            def.resolve(results);
          }));
        } else {
          def.resolve([]);
        }
      }));

      return def;
    },

    _getAllLayerFeatures: function (lyr, fields) {
      var def = new Deferred();

      var fieldNames = [this.editLayer.objectIdField];
      array.forEach(fields, function (field) {
        if (field.name) {
          fieldNames.push(field.name);
        }
      });
      if (fieldNames.length < 2) {
        fieldNames = fields;
      }

      var max = lyr.maxRecordCount;

      var q = new Query();
      q.where = "1=1";
      lyr.queryIds(q).then(function (ids) {
        var queries = [];
        var i, j;
        if (ids.length > 0) {
          for (i = 0, j = ids.length; i < j; i += max) {
            var q = new Query();
            q.outFields = fieldNames;
            q.objectIds = ids.slice(i, i + max);
            q.returnGeometry = true;

            queries.push(lyr.queryFeatures(q));
          }
          var queryList = new DeferredList(queries);
          queryList.then(lang.hitch(this, function (queryResults) {
            if (queryResults) {
              var allFeatures = [];
              for (var i = 0; i < queryResults.length; i++) {
                if (queryResults[i][1].features) {
                  //allFeatures.push.apply(allFeatures, queryResults[i][1].features);
                  //may not do this if it takes a performance hit...just seems like less to keep in memory
                  allFeatures.push.apply(allFeatures, queryResults[i][1].features.map(function (f) {
                    return {
                      geometry: f.geometry,
                      attributes: f.attributes
                    };
                  }));
                }
              }
              def.resolve(allFeatures);
            }
          }));
        } else {
          def.resolve([]);
        }
      });
      return def;
    },

    //TODO this is the main function that needs attention right now
    _locateData: function (useAddress) {
      var def = new Deferred();
      if (useAddress) {
        this._findDuplicates().then(lang.hitch(this, function (duplicateData) {
          this.duplicateData = duplicateData;
          //recursive function that will process un-matched records when more than one locator has been provided
          var _geocodeData = lang.hitch(this, function (storeItems, _idx, finalResults) {
            var def = new Deferred();
            var locatorSource = this._geocodeSources[_idx];
            var locator = locatorSource.locator;
            locator.outSpatialReference = this.spatialReference;
            var unMatchedStoreItems = [];
            var geocodeOps = [];
            var oid = "OBJECTID";
            var max = 500;
            var x = 0;
            var i, j;
            //loop through all provided store items
            store_item_loop:
            for (i = 0, j = storeItems.length; i < j; i += max) {
              var items = storeItems.slice(i, i + max);
              var addresses = [];
              if (locatorSource.singleEnabled || locatorSource.multiEnabled) {
                array.forEach(items, lang.hitch(this, function (item) {
                  var csvID = item._csvId;
                  //test if ID is in duplicate data
                  var duplicateItem = null;
                  duplicate_data_loop:
                  for (var duplicateKey in this.duplicateData) {
                    var duplicateDataItem = this.duplicateData[duplicateKey];
                    if (duplicateDataItem.fileId === csvID) {
                      //look and see if I cab actually just pass the geom here or if I need to muck with it
                      duplicateItem = Object.assign({}, duplicateDataItem);
                      delete this.duplicateData[duplicateKey];
                      break duplicate_data_loop;
                    }
                  }

                  var addr = {};
                  addr[oid] = csvID;
                  if (this.useMultiFields && locatorSource.multiEnabled) {
                    array.forEach(this.multiFields, lang.hitch(this, function (f) {
                      this._currentAddressFields = this.multiFields;
                      if (f.value !== this.nls.noValue) {
                        var val = this.csvStore.getValue(item, f.value);
                        addr[f.keyField] = val;
                      } else {
                        addr[f.keyField] = undefined;
                      }
                    }));
                  } else if (locatorSource.singleEnabled) {
                    if (this.singleFields[0].value !== this.nls.noValue) {
                      this._currentAddressFields = this.singleFields;
                      var s_val = this.csvStore.getValue(item, this.singleFields[0].value);
                      if (typeof (s_val) === 'undefined') {
                        //otherwise multiple undefined values are seen as the same key
                        // may need to think through other potential duplicates
                        s_val = typeof (s_val) + csvID;
                      }
                      addr[locatorSource.singleLineFieldName] = s_val;
                    }
                  }

                  var clone = Object.assign({}, addr);
                  delete clone[oid];
                  var cacheKey = JSON.stringify(clone);
                  if (duplicateItem === null) {
                    addresses.push(addr);
                    finalResults[cacheKey] = {
                      index: x,
                      csvIndex: csvID,
                      location: {}
                    };
                    x += 1;
                  } else {
                    if (duplicateItem !== null) {
                      finalResults[cacheKey] = {
                        index: -1,
                        csvIndex: csvID,
                        isDuplicate: true,
                        location: Object.assign({}, duplicateItem.feature.geometry),
                        featureAttributes: duplicateItem.feature.attributes
                      };
                    }
                  }
                }));
              }
              geocodeOps.push(locator.addressesToLocations({
                addresses: addresses,
                countryCode: locatorSource.countryCode,
                outFields: ["ResultID", "Score"]
              }));
            }
            var keys = Object.keys(finalResults);
            var geocodeList = new DeferredList(geocodeOps);
            geocodeList.then(lang.hitch(this, function (results) {
              _idx += 1;
              //var storeItems = this.storeItems;
              var additionalLocators = this._geocodeSources.length > _idx;
              if (results) {
                var minScore = this.minScore;
                var idx = 0;
                array.forEach(results, lang.hitch(this, function (r) {
                  var defResults = r[1];
                  array.forEach(defResults, function (result) {
                    result.ResultID = result.attributes.ResultID;
                  });
                  var geocodeDataStore = Observable(new Memory({
                    data: defResults,
                    idProperty: "ResultID"
                  }));
                  var resultsSort = geocodeDataStore.query({}, { sort: [{ attribute: "ResultID" }] });
                  array.forEach(resultsSort, lang.hitch(this, function (_r) {
                    for (var k in keys) {
                      var _i = keys[k];
                      if (finalResults[_i] && finalResults[_i].index === idx) {
                        if (_r.attributes.Score < minScore) {
                          if (additionalLocators) {
                            //unMatchedStoreItems.push(storeItems[finalResults[_i].csvIndex]);
                            delete finalResults[_i];
                          }
                        } else {
                          finalResults[_i].location = _r.location;
                          finalResults[_i].score = _r.attributes.Score;

                          ////These need to be persisted to support additional locate operations but need to be avoided when going into theactual layer
                          //array.forEach(this._currentAddressFields, lang.hitch(this, function (f) {
                          //  finalResults[_i][this.matchFieldPrefix + f.keyField] = _r.attributes[f.keyField];
                          //}));

                          //finalResults[_i].locatorAttributes = _r.attributes;
                          delete finalResults[_i].index;
                        }
                        delete keys[k];
                        break;
                      }
                    }
                    idx += 1;
                  }));
                }));
                if (additionalLocators && unMatchedStoreItems.length > 0) {
                  _geocodeData(finalResults, unMatchedStoreItems, _idx, finalResults)
                    .then(lang.hitch(this, function (data) {
                      def.resolve(data);
                    }));
                } else {
                  def.resolve(finalResults);
                  return def.promise;
                }
              }
            }));
            return def;
          });

          //make the inital call to this recursive function
          _geocodeData(this.storeItems, 0, {}).then(lang.hitch(this, function (results) {
            def.resolve(results);
          }));
        }));
      } else {
        this._currentAddressFields = [{
          keyField: this.xFieldName,
          label: this.xFieldName,
          value: this.xFieldName
        }, {
          keyField: this.yFieldName,
          label: this.yFieldName,
          value: this.yFieldName
        }];
        this._xyData({
          storeItems: this.storeItems,
          csvStore: this.csvStore,
          xFieldName: this.xFieldName,
          yFieldName: this.yFieldName,
          wkid: this.spatialReference.wkid
        }).then(function (data) {
          def.resolve(data);
        });
      }
      return def;
    },

    _xyData: function (options) {
      //TODO eventually it would be good to use the defense solutions parsing logic...we could suppport many types of coordinates
      var def = new Deferred();
      var data = [];
      var csvStore = options.csvStore;
      array.forEach(options.storeItems, lang.hitch(this, function (i) {
        var attributes = {};
        var _attrs = csvStore.getAttributes(i);
        array.forEach(_attrs, function (a) {
          attributes[a] = csvStore.getValue(i, a);
        });
        var x = parseFloat(csvStore.getValue(i, options.xFieldName));
        var y = parseFloat(csvStore.getValue(i, options.yFieldName));

        var geometry = this._getGeometry(x, y);
        if (geometry) {
          data.push({
            attributes: attributes,
            location: geometry,
            csvIndex: i._csvId,
            score: 100
          });
        }
      }));
      def.resolve(data);
      return def;
    },

    _getGeometry: function (x, y) {
      var isGeographic;
      if (typeof (isGeographic) === 'undefined') {
        isGeographic = /(?=^[-]?\d{1,3}\.)^[-]?\d{1,3}\.\d+|(?=^[-]?\d{4,})|^[-]?\d{1,3}/.exec(x) ? true : false;
      }

      var geometry;
      //TODO may want to consider some other tests here to make sure we avoid
      // potential funky/bad corrds from passing through
      if (!isNaN(x) && !isNaN(y)) {
        geometry = new Point(x, y);
        if (isGeographic) {
          geometry = webMercatorUtils.geographicToWebMercator(geometry);
        } else {
          geometry.spatialReference = new SpatialReference({ wkid: this.spatialReference.wkid });
        }
        return geometry;
      }
    },

    _generateFC: function (features) {
      //create a feature collection for the input csv file
      var lyr = {
        "layerDefinition": {
          "geometryType": "esriGeometryPoint",
          "spatialReference": this.editLayer.spatialReference,
          "objectIdField": this.objectIdField,
          "type": "Feature Layer",
          "drawingInfo": {
            "renderer": {
              "type": "simple",
              "symbol": this.symbol
            }
          },
          "fields": [{
            "name": this.objectIdField,
            "alias": this.objectIdField,
            "type": "esriFieldTypeOID"
          }]
        },
        "featureSet": {
          "features": features,
          "geometryType": "esriGeometryPoint"
        }
      };

      array.forEach(this.fsFields, lang.hitch(this, function (field) {
        lyr.layerDefinition.fields.push({
          "name": field.name,
          "alias": field.label,
          "type": field.value,
          "editable": true,
          "domain": null
        });
      }));

      return lyr;
    },

    clear: function () {
      this._removeLayer(this.matchedFeatureLayer);
      this._removeLayer(this.unMatchedFeatureLayer);
      this._removeLayer(this.duplicateFeatureLayer);

      this.file = undefined;
      this.fsFields = undefined;
      this.data = undefined;
      this.separatorCharacter = undefined;
      this.csvStore = undefined;
      this.storeItems = undefined;
      this.duplicateData = [];
      this.matchedFeatureLayer = undefined;
      this.unMatchedFeatureLayer = undefined;
      this.duplicateFeatureLayer = undefined;
      this.mappedArrayFields = undefined;
      this.useAddr = true;
      this.addrFieldName = "";
      this.xFieldName = "";
      this.yFieldName = "";
    },

    _removeLayer: function (layer) {
      if (layer) {
        this.map.removeLayer(layer);
        layer.clear();
      }
    },

    _getSeparator: function () {
      var newLineIndex = this.data.indexOf("\n");
      var firstLine = lang.trim(this.data.substr(0, newLineIndex));
      var separators = [",", "      ", ";", "|"];
      var maxSeparatorLength = 0;
      var maxSeparatorValue = "";
      array.forEach(separators, function (separator) {
        var length = firstLine.split(separator).length;
        if (length > maxSeparatorLength) {
          maxSeparatorLength = length;
          maxSeparatorValue = separator;
        }
      });
      this.separatorCharacter = maxSeparatorValue;
    },

    _getCsvStore: function () {
      var def = new Deferred();
      this.csvStore = new CsvStore({
        data: this.data,
        separator: this.separatorCharacter
      });
      this.csvStore.fetch({
        onComplete: lang.hitch(this, function (items) {
          this.storeItems = items;
          this._fetchFieldsAndUpdateForm(this.storeItems, this.csvStore, this.fsFields).then(function (fieldsInfo) {
            def.resolve(fieldsInfo);
          });
        }),
        onError: function (error) {
          console.error("Error fetching items from CSV store: ", error);
          def.reject(error);
        }
      });
      return def;
    },

    //check the values in the fields to evaluate if they are potential candidates for an integer of float field
    // allows us to filter the list of fields exposed for those field types from the destination layer
    _fetchFieldsAndUpdateForm: function (storeItems, csvStore, fsFields) {
      var def = new Deferred();
      var csvFieldNames = csvStore._attributes;
      var fieldTypes = {};
      var len = function (v) {
        return v.toString().length;
      };
      array.forEach(csvFieldNames, function (attr) {
        //var type = null;
        array.forEach(storeItems, function (si) {
          var checkVal = true;
          var fTypeInt = true;
          var fTypeFloat = true;
          if (fieldTypes.hasOwnProperty(attr)) {
            fTypeInt = fieldTypes[attr].supportsInt;
            fTypeFloat = fieldTypes[attr].supportsFloat;
            if (!(fTypeInt) && !(fTypeFloat)) {
              checkVal = false;
            }
          }
          if (checkVal) {
            var v = csvStore.getValue(si, attr);
            if (v) {
              fieldTypes[attr] = {
                supportsInt: ((!isNaN(parseInt(v, 10))) && len(parseInt(v, 10)) === len(v)) && fTypeInt,
                supportsFloat: ((!isNaN(parseFloat(v))) && len(parseFloat(v)) === len(v)) && fTypeFloat
              };
            }
          }
        });
      });
      def.resolve({
        fields: csvFieldNames,
        fieldTypes: fieldTypes,
        fsFields: fsFields
      });
      return def;
    },

    //This should go into a util class
    _zoomToData: function (graphics) {
      if (graphics && graphics.length > 0) {
        try {
          //TODO this would not handle null features
          var ext = graphicsUtils.graphicsExtent(graphics);
          this.map.setExtent(ext.expand(1.9), true);
        } catch (err) {
          console.log(err.message);
        }
      }
    },

    _convertSources: function () {
      if (this.geocodeSources && this.geocodeSources.length > 0) {
        this._geocodeSources = array.map(this.geocodeSources, lang.hitch(this, function (source) {
          if (source && source.url && source.type === 'locator') {
            var _source = {
              locator: new Locator(source.url || ""),
              outFields: ["ResultID", "Score"],
              singleLineFieldName: source.singleLineFieldName || "",
              name: jimuUtils.stripHTML(source.name || ""),
              placeholder: jimuUtils.stripHTML(source.placeholder || ""),
              countryCode: source.countryCode || "",
              addressFields: source.addressFields,
              singleEnabled: source.singleEnabled || false,
              multiEnabled: source.multiEnabled || false
            };
            return _source;
          }
        }));
      }
    }
  });
});