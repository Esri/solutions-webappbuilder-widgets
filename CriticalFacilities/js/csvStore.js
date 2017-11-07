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
    'dojo/_base/html',
    'dojo/query',
    'dojo/on',
    'dojo/Deferred',
    'dojo/DeferredList',
    'dojo/Evented',
    'dojox/data/CsvStore',
    'dojo/store/Observable',
    'dojo/store/Memory',
    'esri/graphicsUtils',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/Point',
    'esri/Color',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/layers/FeatureLayer',
    'esri/tasks/locator',
    'jimu/utils',
    './GeocodeCacheManager',
    './UnMatchedList'
],
function (declare, array, lang, html, query, on, Deferred, DeferredList, Evented, CsvStore, Observable, Memory,
  graphicsUtils, webMercatorUtils, Point, Color, SimpleMarkerSymbol, SimpleRenderer, FeatureLayer, Locator,
  jimuUtils, GeocodeCacheManager, UnMatchedList) {
  return declare([Evented], {

    //Should multi and single be supported within a single locator?

    //may just move away from the this.useMultiFields alltogether since each source should know what it supports
    //but each source can use either actually...need to really think through this
    //so if they flag single and multi on a single locator...that locator should actually be processed twice
    //once for multi and once for single is what I am thinking 

    //TODO may move all geocode logic into GeocodeCacheManager if we go with supporting that
    // Main doubt with the cache idea is for proper handeling if the locations provided by the world geocoder change
    // would basically need to test each address in the cahce individually to avoid additional credit consumption. This could be way too chatty
    // could make it's use optional also


    //TODO move away from cache manager...add function to search for duplicates in the service
    // need to understand how we know what fields from the service should be compared with serch layers

    constructor: function (options) {
      this.file = options.file;
      this.map = options.map;
      this.spatialReference = this.map.spatialReference;
      this.fsFields = options.fsFields;
      this.geocodeSources = options.geocodeSources;
      this.unMatchedContainer = options.unMatchedContainer;

      this.data = null;
      this.separatorCharacter = null;
      this.csvStore = null;
      this.storeItems = null;
      this.featureCollection = null;
      this.featureLayer = null;
      this.mappedArrayFields = null;
      this.unMatchedFeatureLayer = null;
      this.duplicateLayer = null;

      this.hasUnmatched = false;
      this.useAddr = true;
      this.addrFieldName = ""; //double check but I don't think this is necessary anymore
      this.xFieldName = "";
      this.yFieldName = "";
      this.objectIdField = "ObjectID";
      this.nls = options.nls;

      //TODO this may need to be configurable
      this.minScore = 90;

      //TODO still deciding on this
      this.geocodeManager = new GeocodeCacheManager({
        appConfig: options.appConfig,
        nls: options.nls
      });
    },

    handleCsv: function () {
      var def = new Deferred();
      if (this.file && !this.file.data) {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          this.data = reader.result;
          this._processCsvData().then(function (fieldsInfo) {
            def.resolve(fieldsInfo)
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
        def.resolve(fieldsInfo)
      });
      return def;
    },

    processForm: function () {
      var def = new Deferred();
      this._locateData(this.useAddr).then(lang.hitch(this, function (data) {
        var results = {};
        this.featureCollection = this._generateFC();
        this.unmatchedFC = this._generateFC();
        var unmatchedI = 0;

        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
          var attributes = {};
          var di = data[keys[i]];
          var si = this.storeItems[di.csvIndex];
          array.forEach(this.fsFields, lang.hitch(this, function (f) {
            attributes[f.name] = this.csvStore.getValue(si, this.mappedArrayFields[f.name]);
          }));

          if (di && di.score > this.minScore) {
            attributes["ObjectID"] = i - unmatchedI;
            this.featureCollection.featureSet.features.push({
              "geometry": di.location,
              "attributes": lang.clone(attributes)
            });
          } else {
            attributes["ObjectID"] = unmatchedI;
            //TODO need to handle the null location by doing something
            this.unmatchedFC.featureSet.features.push({
              "geometry": new Point(0, 0, this.map.spatialReference),
              "attributes": lang.clone(attributes)
            });
            unmatchedI++;
          }
        }

        if (unmatchedI > 0) {
          //TODO need to clear this.unMatchedContainer
          //if (this.unMatchedContainer.children.length > 0) {
          //  array.forEach(this.unMatchedContainer.children, html.destroy);
          //}

          this.hasUnmatched = true;
          this.unMatchedFeatureLayer = this._initLayer(this.unmatchedFC,
            this.file.name += "_UnMatched");

          //var unmatchedList = new UnMatchedList();
          //unmatchedList.createList({
          //  featureSet: this.unmatchedFC.featureSet,
          //  map: this.map,
          //  fields: this.fsFields,
          //  configFields: this.mappedArrayFields,
          //  nls: this.nls
          //});

          //html.place(unmatchedList.list.domNode, this.unMatchedContainer);



        }

        //TODO this should be the theme color
        this.featureLayer = this._initLayer(this.featureCollection, this.file.name);

        this._zoomToData(this.featureLayer);
        def.resolve({
          matchedLayer: this.featureLayer,
          unmatchedLayer: this.unMatchedFeatureLayer,
          duplicateLayer: this.duplicateLayer
        });

      }));
      return def;
    },

    _initLayer: function (fc, id) {
      var lyr = new FeatureLayer(fc, {
        id: id,
        editable: true,
        outFields: ["*"]
      });
      this.map.addLayers([lyr]);
      return lyr;
    },

    //TODO this is the main function that needs attention right now
    _locateData: function (useAddress) {
      var def = new Deferred();
      if (useAddress) {
        this.geocodeManager.getCache().then(lang.hitch(this, function (cacheData) {
          //recursive function that will process un-matched records when more than one locator has been provided
          var _geocodeData = lang.hitch(this, function (cacheData, storeItems, _idx, finalResults) {
            cacheData = {}; //TODO prevent cache logic for now
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
            for (var i = 0, j = storeItems.length; i < j; i += max) {
              var items = storeItems.slice(i, i + max);
              var addresses = [];
              if (locatorSource.singleEnabled || locatorSource.multiEnabled) {
                array.forEach(items, lang.hitch(this, function (item) {
                  var csvID = item._csvId;
                  var addr = {};
                  addr[oid] = csvID;
                  if (this.useMultiFields && locatorSource.multiEnabled) {
                    array.forEach(this.multiFields, lang.hitch(this, function (f) {
                      if (f.value !== this.nls.noValue) {
                        var val = this.csvStore.getValue(item, f.value);
                        addr[f.keyField] = val;
                      }
                    }));
                  } else if (locatorSource.singleEnabled) {
                    if (this.singleFields[0].value !== this.nls.noValue) {
                      var s_val = this.csvStore.getValue(item, this.singleFields[0].value);
                      if (typeof (s_val) === 'undefined') {
                        //otherwise multiple undefined values are seen as the same key
                        // may need to think through other potential duplicates
                        s_val = typeof (s_val) + csvID;
                      }
                      addr[locatorSource.singleLineFieldName] = s_val;
                    }
                  }

                  //most of this is to support the cahce concept that I'm not sure if it will stick around
                  var clone = Object.assign({}, addr);
                  delete clone[oid]
                  var cacheKey = JSON.stringify(clone);
                  var _cacheData = cacheData ? cacheData : {};
                  if (!(_cacheData && _cacheData.hasOwnProperty(cacheKey) ? true : false)) {
                    addresses.push(addr);
                    finalResults[cacheKey] = {
                      index: x,
                      csvIndex: csvID,
                      location: {}
                    };
                    x += 1
                  } else {
                    finalResults[cacheKey] = {
                      index: -1,
                      csvIndex: csvID,
                      location: _cacheData[cacheKey].location
                    };
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
                array.forEach(results, function (r) {
                  var defResults = r[1];
                  array.forEach(defResults, function (result) {
                    result.ResultID = result.attributes.ResultID;
                  });
                  var geocodeDataStore = Observable(new Memory({
                    data: defResults,
                    idProperty: "ResultID"
                  }));
                  var resultsSort = geocodeDataStore.query({}, { sort: [{ attribute: "ResultID" }] });
                  array.forEach(resultsSort, function (_r) {
                    for (var k in keys) {
                      var _i = keys[k];
                      if (finalResults[_i] && finalResults[_i].index === idx) {
                        if (_r.attributes["Score"] < minScore) {
                          if (additionalLocators) {
                            //unMatchedStoreItems.push(storeItems[finalResults[_i].csvIndex]);
                            delete finalResults[_i];
                          }
                        } else {
                          finalResults[_i].location = _r.location;
                          finalResults[_i].score = _r.attributes["Score"];
                          delete finalResults[_i].index
                        }
                        delete keys[k];
                        break;
                      }
                    }
                    idx += 1;
                  });
                });
                if (additionalLocators && unMatchedStoreItems.length > 0) {
                  _geocodeData(finalResults, unMatchedStoreItems, _idx, finalResults).then(lang.hitch(this, function (data) {
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
          _geocodeData(cacheData, this.storeItems, 0, {}).then(lang.hitch(this, function (a) {
            def.resolve(a);
          }));
        }));
      } else {
        this._xyData({
          storeItems: this.storeItems,
          csvStore: this.csvStore,
          xFieldName: this.xFieldName,
          yFieldName: this.yFieldName,
          wkid: this.map.spatialReference.wkid
        }).then(function (data) {
          def.resolve(data);
        });
      }
      return def;
    },

    _xyData: function (options) {
      var def = new Deferred();
      var isGeographic = undefined;
      var data = [];
      var csvStore = options.csvStore;
      array.forEach(options.storeItems, function (i) {
        var attributes = {};
        var _attrs = csvStore.getAttributes(i);
        array.forEach(_attrs, function (a) {
          attributes[a] = csvStore.getValue(i, a);
        });
        var x = parseFloat(csvStore.getValue(i, options.xFieldName));
        var y = parseFloat(csvStore.getValue(i, options.yFieldName));
        if (typeof (isGeographic) === 'undefined') {
          isGeographic = /(?=^[-]?\d{1,3}\.)^[-]?\d{1,3}\.\d+|(?=^[-]?\d{4,})|^[-]?\d{1,3}/.exec(x) ? true : false;
        }

        //TODO may want to consider some other tests here to make sure we avoid
        // potential funky/bad corrds from passing through
        if (x !== NaN && y !== NaN) {
          var geometry = new Point(x, y);
          if (isGeographic) {
            geometry = webMercatorUtils.geographicToWebMercator(geometry);
          } else {
            geometry.spatialReference = new SpatialReference({ wkid: options.wkid });
          }
          data.push({
            attributes: attributes,
            location: geometry,
            csvIndex: i._csvId,
            score: 100
          })
        }
      });
      def.resolve(data);
      return def;
    },

    _generateFC: function () {
      var baseImageUrl = window.location.protocol + "//" + window.location.host + require.toUrl("widgets");
      //create a feature collection for the input csv file
      var lyr = {
        "layerDefinition": {
          "geometryType": "esriGeometryPoint",
          "objectIdField": this.objectIdField,
          "type": "Feature Layer",
          "drawingInfo": {
            "renderer": {
              "type": "simple",
              "symbol": {
                "type": "esriPMS",
                "url": baseImageUrl + "/CriticalFacilities/images/redpushpin.png",
                "contentType": "image/png",
                "width": 15,
                "height": 15
              }
            }
          },
          "fields": [
              {
                "name": this.objectIdField,
                "alias": this.objectIdField,
                "type": "esriFieldTypeOID"
              }
          ]
        },
        "featureSet": {
          "features": [],
          "geometryType": "esriGeometryPoint"
        }
      };

      array.forEach(this.fsFields, lang.hitch(this, function (af) {
        lyr.layerDefinition.fields.push({
          "name": af.name,
          "alias": af.label,
          "type": af.value,
          "editable": true,
          "domain": null
        });
      }));

      return lyr;
    },

    clear: function () {
      if (this.featureLayer) {
        this.map.removeLayer(this.featureLayer);
        this.featureLayer.clear();
      }
      if (this.unMatchedFeatureLayer) {
        this.map.removeLayer(this.unMatchedFeatureLayer);
        this.unMatchedFeatureLayer.clear();
      }
      this.file = undefined;
      this.fsFields = undefined;
      this.data = undefined;
      this.separatorCharacter = undefined;
      this.csvStore = undefined;
      this.storeItems = undefined;
      this.featureCollection = undefined;
      this.featureLayer = undefined;
      this.unMatchedFeatureLayer = undefined;
      this.mappedArrayFields = undefined;
      this.useAddr = true;
      this.addrFieldName = "";
      this.xFieldName = "";
      this.yFieldName = "";
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
            def.resolve(fieldsInfo)
          });
        }),
        onError: function (error) {
          console.error("Error fetching items from CSV store: ", error);
          def.reject(error);
        }
      });
      return def;
    },

    _fetchFieldsAndUpdateForm: function (storeItems, csvStore, fsFields) {
      var def = new Deferred();
      var csvFieldNames = csvStore._attributes;
      var fieldTypes = {};
      var len = function (v) {
        return v.toString().length;
      };
      array.forEach(csvFieldNames, function (attr) {
        var type = null;
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
                supportsInt: ((parseInt(v) !== NaN) && len(parseInt(v)) === len(v)) && fTypeInt,
                supportsFloat: ((parseFloat(v) !== NaN) && len(parseFloat(v)) === len(v)) && fTypeFloat
              }
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

    _zoomToData: function (featureLayer) {
      if (featureLayer.graphics && featureLayer.graphics.length > 0) {
        try {
          //TODO this would not handle null features
          var ext = graphicsUtils.graphicsExtent(featureLayer.graphics);
          this.map.setExtent(ext.expand(1.5), true)
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