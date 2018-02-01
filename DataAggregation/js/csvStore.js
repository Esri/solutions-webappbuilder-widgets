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
    'esri/dijit/PopupTemplate',
  'jimu/utils',
  'moment/moment'
],
function (declare, array, lang, Deferred, DeferredList, Evented, CsvStore, Observable, Memory,
  graphicsUtils, webMercatorUtils, Point, FeatureLayer, Locator, Query, SpatialReference, PopupTemplate,
  jimuUtils, moment) {
  return declare([Evented], {

    //may just move away from the this.useMultiFields alltogether since each source should know what it supports
    //but each source can use either actually...need to really think through this
    //so if they flag single and multi on a single locator...that locator should actually be processed twice
    //once for multi and once for single is what I am thinking

    //When storing address details need to store the locator index that was used to generate a given address in addition to
    // the address so when feature views potentially re-geocode they use the same one

    //TODO need to set this._currentAddressFields for XY fields
    //TODO flag other field types and if things will fit like DATE

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
    _internalFields: [],

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
      //fields that we add that need to not show up in the popup
      this._internalFields = ['DestinationOID', 'matchScore', 'hasDuplicateUpdates', 'duplicateState'];
      this._matchFields = [];
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
            var matchField = this.matchFieldPrefix + f.keyField;
            if (typeof (f.value) !== 'undefined') {
              attributes[matchField] = this.csvStore.getValue(si, f.value);
            } else {
              attributes[matchField] = undefined;
            }
            this._matchFields.push(matchField);
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
            //If additional fields are auto added this._internalFields needs to be updated
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
        this.matchedFeatureLayer = this._initLayer(matchedFeatures, this.file.name.replace('.csv', ''));

        if (duplicateFeatures.length > 0) {
          this.duplicateFeatureLayer = this._initLayer(duplicateFeatures,
            this.file.name.replace('.csv', '') + "_Duplicate");
        }

        if (unmatchedFeatures.length > 0) {
          this.unMatchedFeatureLayer = this._initLayer(unmatchedFeatures,
            this.file.name.replace('.csv', '') + "_UnMatched");
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
      this._initPopup(lyr);
      this.map.addLayers([lyr]);
      return lyr;
    },

    _initPopup: function (layer) {
      var content = { title: layer.id + ": {" + this.labelField + "}" };
      var fieldInfos = [];
      array.forEach(layer.fields, lang.hitch(this, function (f) {
        if (f.name !== this.objectIdField && this._internalFields.indexOf(f.name) === -1 &&
          this._matchFields.indexOf(f.name) === -1) {
          fieldInfos.push({ fieldName: f.name, visible: true });
        }
      }));
      content.fieldInfos = fieldInfos;
      layer.infoTemplate = new PopupTemplate(content);
    },

    _findDuplicates: function () {
      var def = new Deferred();
      this._getAllLayerFeatures(this.editLayer, this.fsFields).then(lang.hitch(this, function (layerFeatures) {
        this.keys = Object.keys(this.mappedArrayFields);
        this.oidField = this.editLayer.objectIdField;

        var compareItems = [];
        var compareFields = [];
        var dupFields = this.duplicateTestFields;
        if (dupFields && dupFields.hasOwnProperty('length') && dupFields.length > 0) {
          array.forEach(this.storeItems, lang.hitch(this, function (si) {
            var compareItem = {
              compareValues: {},
              fileId: si._csvId,
              featureId: -1
            };
            array.forEach(dupFields, lang.hitch(this, function (dupField) {
              var fileFieldName = this.mappedArrayFields[dupField];
              if (typeof(fileFieldName) !== 'undefined') {
                compareItem.compareValues[dupField] = this.csvStore.getValue(si, fileFieldName);
                if (compareFields.indexOf(dupField) === -1) {
                  compareFields.push(dupField);
                }
              }
            }));
            if (Object.keys(compareItem.compareValues).length > 0) {
              compareItems.push(compareItem);
            }
          }));
        }

        var results = [];
        if (compareItems.length > 0) {
          //if multiple compare items match to a single feature what would be the expectation
          array.forEach(compareItems, lang.hitch(this, function (item) {
            array.forEach(layerFeatures, lang.hitch(this, function (feature) {
              var featureItem = {};
              array.forEach(compareFields, lang.hitch(this, function (f) {
                featureItem[f] = feature.attributes[f];
              }));


              if (JSON.stringify(item.compareValues) === JSON.stringify(featureItem)) {
                var featureId = feature.attributes[this.oidField];
                if (item.featureId !== -1) {
                  //not really sure how we would want to handle this situation but setting a flag and keeping track
                  // of the other ids for now
                  item.hasMultiDuplicates = true;
                  if (typeof (item.featureIds) === 'undefined') {
                    item.featureIds = [featureId];
                  } else {
                    item.featureIds.push(featureId);
                  }
                } else {
                  item.featureId = featureId;
                  item.feature = feature;
                  results.push(item);
                }
              }
            }));
          }));
        }
        def.resolve(results);
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
                      //Object.assign fails in IE
                      //duplicateItem = Object.assign({}, duplicateDataItem);
                      duplicateItem = lang.mixin({}, duplicateDataItem);
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
                  //Object.assign fails in IE
                  //var clone = Object.assign({}, addr);
                  var clone = lang.mixin({}, addr);
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
                        //location: Object.assign({}, duplicateItem.feature.geometry), //Object.assign fails in IE
                        location: lang.mixin({}, duplicateItem.feature.geometry),
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
      //the checking of unique vals is for domain support
      //TODO need to expand to support more than codedValues
      //var maxUniqueDomainVals = 0;
      //array.forEach(fsFields, function (f) {
      //  if (typeof (f.domain) !== 'undefined') {
      //    //if the number of unique values in the data exceeds the potential unique values
      //    // in the domain they cannot match
      //    if (f.domain.codedValues && f.domain.codedValues.hasOwnProperty('length')) {
      //      if (maxUniqueDomainVals < f.domain.codedValues.length) {
      //        maxUniqueDomainVals = f.domain.codedValues.length;
      //      }
      //    }
      //  }
      //});

      var def = new Deferred();
      var csvFieldNames = csvStore._attributes;
      var fieldTypes = { };
      var len = function (v) {
        return v.toString().length;
      };
      array.forEach(csvFieldNames, function (attr) {
        //var type = null;
        array.forEach(storeItems, function (si) {
          var checkVal = true;
          var checkDomain = false;
          var checkLen = false;
          var fTypeInt = true;
          var fTypeFloat = true;
          var fTypeDate = true;
          //var currentUniqueVals;
          //var currentLen;
          if (fieldTypes.hasOwnProperty(attr)) {
            fTypeInt = fieldTypes[attr].supportsInt;
            fTypeFloat = fieldTypes[attr].supportsFloat;
            fTypeDate = fieldTypes[attr].supportsDate;
            //currentUniqueVals = fieldTypes[attr].uniqueVals;
            //if (!currentUniqueVals) {
            //  currentUniqueVals = [];
            //  console.log('s');
            //}
            //currentLen = fieldTypes[attr].maxLength;
            if (!(fTypeInt) && !(fTypeFloat) && !(fTypeDate)) {
              checkVal = false;
            }
            //if (currentUniqueVals.length > maxUniqueDomainVals) {
            //  checkDomain = false;
            //}
          }
          if (checkVal || checkDomain || checkLen) {
            var v = csvStore.getValue(si, attr);
            if (v) {
              var lenV = len(v);
              var date = moment(v);
              if (checkVal) {
                fieldTypes[attr] = {
                  supportsDate: date.isValid() && fTypeDate,
                  supportsInt: ((!isNaN(parseInt(v, 10))) && len(parseInt(v, 10)) === lenV) && fTypeInt,
                  supportsFloat: ((!isNaN(parseFloat(v))) && len(parseFloat(v)) === lenV) && fTypeFloat
                };
              }
              //var ft = fieldTypes[attr];
              //if (checkDomain) {
              //  ft.uniqueVals = currentUniqueVals;
              //  if (typeof (ft.uniqueVals) === 'undefined') {
              //    ft.uniqueVals = [v];
              //  } else if (ft.uniqueVals.indexOf(v) === -1) {
              //    ft.uniqueVals.push(v);
              //  }
              //} else {
              //  ft.uniqueVals = currentUniqueVals;
              //  ft.supportsDomain = false;
              //}

              //if (checkLen) {
              //  ft.maxLength = currentLen;
              //  if (typeof (ft.maxLength) === 'undefined') {
              //    ft.maxLength = lenV;
              //    ft.maxDateLength = len(date.unix())
              //  } else if (ft.maxLength < lenV) {
              //    ft.maxLength = lenV;
              //  }
              //  var lenMaxDate = len(date.unix());
              //  if (typeof (ft.maxDateLength) === 'undefined' && date.isValid()) {
              //    ft.maxDateLength = lenMaxDate;
              //  } else if (ft.maxDateLength < lenMaxDate) {
              //    ft.maxDateLength = lenMaxDate;
              //  }
              //}
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
    _zoomToData: function (graphics, expand) {
      if (graphics && graphics.length > 0) {
        try {
          //TODO this would not handle null features
          var ext = graphicsUtils.graphicsExtent(graphics);
          if (expand) {
            this.map.setExtent(ext.expand(1.9), true);
          } else {
            this.map.setExtent(ext, true);
          }
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