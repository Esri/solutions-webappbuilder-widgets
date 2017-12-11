///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/Color',
  'dojo/_base/array',
  'dojo/DeferredList',
  'dojo/Deferred',
  'dojo/dom-class',
  'dojo/dom-construct',
  'dojo/dom-geometry',
  'dojo/dom-style',
  'dojo/on',
  'jimu/utils',
  'esri/geometry/geometryEngine',
  'esri/graphic',
  'esri/Color',
  'esri/layers/FeatureLayer',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/Font',
  'esri/symbols/TextSymbol',
  'esri/tasks/query',
  './analysisUtils'
], function (
  declare,
  lang,
  Color,
  array,
  DeferredList,
  Deferred,
  domClass,
  domConstruct,
  domGeom,
  domStyle,
  on,
  utils,
  geometryEngine,
  Graphic,
  esriColor,
  FeatureLayer,
  SimpleMarkerSymbol,
  SimpleLineSymbol,
  Font,
  TextSymbol,
  Query,
  analysisUtils
) {

  var closestInfo = declare('ClosestInfo', null, {

    featureCount: 0,
    mapServiceLayer: false,
    loading: false,
    queryOnLoad: false,
    incidentCount: 0,

    constructor: function (tab, container, parent) {
      this.tab = tab;
      this.container = container;
      this.parent = parent;
      this.incident = null;
      this.graphicsLayer = null;
      this.map = parent.map;
      this.specialFields = {};
      this.typeIdField = "";
      this.types = [];
      this.dateFields = {};
      this.config = parent.config;
      this.baseLabel = tab.label !== "" ? tab.label : tab.layerTitle ? tab.layerTitle : tab.layers;
    },

    //TODO this.summaryFields does not seem to be used
    //but I believe it could be...we really only need to get the fields once
    //may need to get all fields and just the 3 dispaly fields seperately
    // so we can ensure that download all and panel display have what the need
    //but we should not have to do that so frequently

    //TODO should the buffer be used in any way
    //curently the calc and this new count is based on the distance from the incident only and
    // does not consider the buffer.
    //So it could be possible that the buffer distance exceeds the max distance defined in the config.
    //This would mean that you have a feature in the buffer that is not returned...is this correct?
    queryTabCount: function (incidents, buffers, updateNode, displayCount) { // jshint ignore:line
      var def = new Deferred();
      this.incidentCount = incidents.length;
      var unit = this.parent.config.distanceUnits;
      var unitCode = this.parent.config.distanceSettings[unit];
      var distance = this.parent.config.maxDistance;

      buffers = [];
      for (var i = 0; i < incidents.length; i++) {
        buffers.push(geometryEngine.buffer(incidents[i].geometry, distance, unitCode));
      }
      var tabLayers = [this.tab.tabLayers[0]];
      if (this.mapServiceLayer && this.tab.tabLayers.length > 1) {
        tabLayers = [this.tab.tabLayers[1]];
      }
      if (this.tab.tabLayers.length > 0) {
        if (this.tab.tabLayers[0].url) {
          if (this.tab.tabLayers[0].url.indexOf("MapServer") > -1) {
            this.mapServiceLayer = true;
            var tempFL;
            if (typeof (this.tab.tabLayers[0].infoTemplate) !== 'undefined') {
              this.summaryLayer = this.tab.tabLayers[0];
              if (this.summaryLayer.hasOwnProperty('loaded') && this.summaryLayer.loaded) {
                this.summaryFields = this._getFields(this.summaryLayer);
                this._performQuery(incidents, buffers, updateNode, displayCount, tabLayers).then(function (r) {
                  def.resolve(r);
                });
              } else {
                tempFL = new FeatureLayer(this.summaryLayer.url);
                tempFL.infoTemplate = this.tab.tabLayers[0].infoTemplate;
                tabLayers = [tempFL];
                this.tab.tabLayers = tabLayers;
                on(tempFL, "load", lang.hitch(this, function () {
                  this.summaryLayer = tempFL;
                  this.summaryFields = this._getFields(this.summaryLayer);
                  this._performQuery(incidents, buffers, updateNode, displayCount, tabLayers).then(function (r) {
                    def.resolve(r);
                  });
                }));
              }
            } else {
              if (!this.loading) {
                tempFL = new FeatureLayer(this.tab.tabLayers[0].url);
                this.loading = true;
                on(tempFL, "load", lang.hitch(this, function () {
                  this.summaryLayer = tempFL;
                  this.summaryFields = this._getFields(this.summaryLayer);
                  var lID = this.tab.tabLayers[0].url.split("MapServer/")[1];
                  var mapLayers = this.parent.map.itemInfo.itemData.operationalLayers;
                  for (var i = 0; i < mapLayers.length; i++) {
                    var lyr = mapLayers[i];
                    if (typeof (lyr.layerObject) !== 'undefined') {
                      if (lyr.layerObject.infoTemplates) {
                        var infoTemplate = lyr.layerObject.infoTemplates[lID];
                        if (infoTemplate) {
                          tempFL.infoTemplate = infoTemplate.infoTemplate;
                          break;
                        }
                      }
                    }
                  }
                  tabLayers = [tempFL];
                  this.tab.tabLayers = tabLayers;
                  this.loading = false;
                  this._performQuery(incidents, buffers, updateNode, displayCount, tabLayers).then(function (r) {
                    def.resolve(r);
                  });
                }));
              }
            }
          }
        }
      }
      if (!this.mapServiceLayer) {
        this._performQuery(incidents, buffers, updateNode, displayCount, tabLayers).then(function (r) {
          def.resolve(r);
        });
      }
      return def;
    },

    //buffers will be populated with max dist from incidents
    _performQuery: function (incidents, buffers, updateNode, displayCount, tabLayers) { // jshint ignore:line
      var def = new Deferred();
      var defArray = [];
      var geom;
      var prevArray;
      var da;
      var geoms = buffers;
      this.summaryGeoms = geoms;
      if (geoms.length > 0) {
        for (var ii = 0; ii < geoms.length; ii++) {
          geom = geoms[ii];
          da = analysisUtils.createDefArray(tabLayers, geom);
          if (ii === 0) {
            defArray = da;
            prevArray = da;
          } else {
            defArray = prevArray.concat(da);
            prevArray = defArray;
          }
        }
      }
      var defList = new DeferredList(defArray);
      defList.then(lang.hitch(this, function (defResults) {
        var length = 0;
        for (var r = 0; r < defResults.length; r++) {
          var featureSet = defResults[r][1];
          if (!isNaN(featureSet)) {
            if (featureSet > 0) {
              length += 1;
            }
          } else if (featureSet && featureSet.features) {
            if (featureSet.features.length > 0) {
              length += 1;
            }
          } else if (featureSet && typeof (featureSet.length) !== 'undefined') {
            if (featureSet.length > 0) {
              length += 1;
            }
          }
        }
        this.updateTabCount(length, updateNode, displayCount);
        def.resolve(length);
      }));
      return def;
    },

    updateTabCount: function (count, updateNode, displayCount) {
      this.featureCount = parseInt(count, 10) === 0 ? 0 : count;
      analysisUtils.updateTabCount(this.featureCount, updateNode, displayCount, this.baseLabel, this.incidentCount);
    },

    updateForIncident: function (incidents, distance, graphicsLayer, snapShot, createSnapShot, downloadAll) {
      this.incidentCount = incidents.length;
      if (typeof (createSnapShot) !== 'undefined' && typeof (downloadAll) !== 'undefined') {
        if (!createSnapShot) {
          this.allFields = downloadAll;
        } else {
          this.allFields = true;
        }
      } else {
        this.allFields = false;
      }
      var isSnapShot = typeof (snapShot) !== 'undefined';
      var def;
      array.forEach(this.tab.tabLayers, lang.hitch(this, function (tab) {
        if (isSnapShot) {
          def = new Deferred();
        }
        if(tab.url){
          var tempFL = new FeatureLayer(tab.url, { mode: FeatureLayer.MODE_ONDEMAND, infoTemplate: tab.infoTemplate });
          on(tempFL, "load", lang.hitch(this, function () {
            this.tab.tabLayers = [tempFL];
            if (isSnapShot) {
              this.processIncident(incidents, distance, graphicsLayer, snapShot).then(lang.hitch(this, function (r) {
                def.resolve(r);
              }), lang.hitch(this, function (err) {
                console.error(err);
                def.reject(err);
              }));
            } else {
              this.processIncident(incidents, distance, graphicsLayer, snapShot);
            }
          }));
        } else {
          if (isSnapShot) {
            this.processIncident(incidents, distance, graphicsLayer, snapShot).then(lang.hitch(this,
              function (results) {
              def.resolve(results);
            }), lang.hitch(this, function (err) {
              console.error(err);
              def.reject(err);
            }));
          } else {
            this.processIncident(incidents, distance, graphicsLayer, snapShot);
          }
        }
      }));
      if (isSnapShot) {
        return def;
      }
    },

    processIncident: function (incidents, distance, graphicsLayer, snapShot) {
      this.incidents = incidents;
      var def;
      var isSnapShot = typeof (snapShot) !== 'undefined';
      if (!isSnapShot) {
        this.container.innerHTML = "";
        domClass.add(this.container, "loading");
      } else {
        def = new Deferred();
      }
      var results = [];

      var unit = this.parent.config.distanceUnits;
      var unitCode = this.parent.config.distanceSettings[unit];

      var inc_buffers = [];
      for (var j = 0; j < incidents.length; j++) {
        var geom = incidents[j].geometry;
        var bufferGeom = geometryEngine.buffer(geom, distance, unitCode);
        inc_buffers.push({geometry: geom, buffer: bufferGeom});
      }

      this.graphicsLayer = graphicsLayer;
      if (this.graphicsLayer) {
        this.graphicsLayer.clear();
      }

      var tabLayers = this.tab.tabLayers;
      var defArray = [];
      var layer = tabLayers[0];
      var fields = this._getFields(layer);
      for (var i = 0; i < inc_buffers.length; i++) {
        var query = new Query();
        query.returnGeometry = true;
        query.outSpatialReference = this.parent.map.spatialReference;
        query.geometry = inc_buffers[i].buffer;
        if (this.parent.config.csvAllFields === "true" || this.parent.config.csvAllFields === true) {
          query.outFields = ['*'];
        } else {
          query.outFields = fields;
        }
        if (typeof (layer.queryFeatures) !== 'undefined') {
          defArray.push(layer.queryFeatures(query));
        }
      }
      var defList = new DeferredList(defArray);
      defList.then(lang.hitch(this, function (defResults) {
        for (var r = 0; r < defResults.length; r++) {
          if (defResults[r][0]) {
            var featureSet = defResults[r][1];
            var graphics = featureSet.features;
            var temp_graphics = [];
            var inc_geom = inc_buffers[r].geometry;
            if (graphics && graphics.length > 0) {
              for (var g = 0; g < graphics.length; g++) {
                var gra = new Graphic(graphics[g].toJson());
                var geom = gra.geometry;
                var dist = analysisUtils.getDistance(inc_geom, geom, this.parent.config.distanceUnits);
                var newAttr = {
                  DISTANCE: dist
                };
                for (var f = 0; f < fields.length; f++) {
                  newAttr[fields[f]] = gra.attributes[fields[f]];
                }
                if (this.config.csvAllFields === true || this.config.csvAllFields === "true") {
                  //do nothing.  All fields in graphic will export.
                  gra.attributes.DISTANCE = dist;
                } else {
                  gra.attributes = newAttr;
                }
                temp_graphics.push(gra);
              }
              temp_graphics.sort(analysisUtils.compareDistance);
              results.push(temp_graphics[0]);
            }
          } else {
            if (defResults[r][1] && defResults[r][1].message) {
              console.log(defResults[r][1].message);
            }
          }
        }
        results.sort(analysisUtils.compareDistance);
        if (!isSnapShot) {
          this._processResults(results);
        } else {
          this._processResults(results, true).then(lang.hitch(this, function (finalResults) {
            def.resolve(finalResults);
          }));
        }
      }), lang.hitch(this, function (err) {
        console.error(err);
        def.reject(err);
      }));
      if (isSnapShot) {
        return def;
      }
    },

    _processResults: function (results, snapShot) {
      var def;
      var tpc;
      var hasResults = results && results.length > 0;
      if (hasResults) {
        if (results[0].geometry.type !== 'point') {
          for (var gi = results.length - 1; gi >= 0; gi--) {
            var ext = results[gi].geometry.getExtent();
            if (typeof (ext) === 'undefined') {
              results.splice(gi, 1);
            }
          }
        }
      }
      if (snapShot) {
        def = new Deferred();
      } else {
        this.container.innerHTML = "";
        domClass.remove(this.container, "loading");

        if (hasResults) {
          tpc = domConstruct.create("div", {
            "class": "SAT_tabPanelContent"
          }, this.container);

          var div_results_extra = domConstruct.create("div", {}, tpc);
          domClass.add(div_results_extra, "SATcolExport");
          domClass.add(div_results_extra, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');
          var div_exp = domConstruct.create("div", {
            title: this.parent.nls.downloadCSV
          }, div_results_extra);
          domClass.add(div_exp, "btnExport");
          on(div_exp, "click", lang.hitch(this, this._exportToCSV, results));
        }
      }

      var unit = this.parent.config.distanceUnits;
      var units = this.parent.nls[unit];
      var analysisResults = [];
      var _w = 220;
      if (hasResults) {
        for (var i = 0; i < results.length; i++) {
          var num = i + 1;
          var gra = results[i];
          var geom = gra.geometry;
          var loc = geom;
          if (geom.type !== "point") {
            loc = geom.getExtent().getCenter();
          }
          var attr = gra.attributes;

          var distLbl;
          if (this.incidents[0].geometry.type === "point") {
            var dist = attr.DISTANCE;
            distLbl = (Math.round(dist * 100) / 100) + " " + units + " (" + this.parent.nls.approximate + ")";
          }

          var info = "";
          var c = 0;
          var row = [];
          if (typeof (this.displayFields) !== 'undefined') {
            for (var ij = 0; ij < this.displayFields.length; ij++) {
              var field = this.displayFields[ij];
              prop_field_loop:
              for (var prop in attr) {
                if (prop !== "DISTANCE" && c < 3) {
                  //TODO should break this inner loop when the stuff has been set no need to go back through it after
                  if (field.expression === prop) {
                    var fVal = analysisUtils.getFieldValue(prop, attr[prop], this.specialFields,
                      this.dateFields, 'longMonthDayYear', this.typeIdField, this.types);
                    var value;
                    if (typeof (fVal) !== 'undefined' && fVal !== null) {
                      value = utils.stripHTML(fVal.toString());
                    } else {
                      value = "";
                    }
                    var label = typeof (field.label) !== 'undefined' ? field.label : undefined;
                    var _fields = (gra._layer && gra._layer.fields) ? gra._layer.fields :
                      (this.tab.tabLayers && this.tab.tabLayers[0]) ? this.tab.tabLayers[0].fields : undefined;
                    if (_fields) {
                      var cF = analysisUtils.getField(_fields, prop);
                      if (cF) {
                        label = cF.alias;
                      }
                    }
                    if (typeof (label) === 'undefined' || label in ['', ' ', null, undefined]) {
                      label = prop;
                    }
                    if (analysisUtils.isURL(value)) {
                      value = '<a href="' + value + '" target="_blank" style="color: inherit;">' + label + '</a>';
                    } else if (analysisUtils.isEmail(value)) {
                      value = '<a href="mailto:' + value + '" style="color: inherit;">' + label + '</a>';
                    }
                    info += (value + "<br/>");
                    c += 1;
                    row.push({
                      value: value.indexOf(',') > -1 ? value.replace(',', '') : value,
                      label: label
                    });
                    break prop_field_loop;
                  }
                }
              }
            }
          }
          analysisResults.push(row);

          if (!snapShot) {
            var div = domConstruct.create("div", {}, tpc);
            domClass.add(div, "SATcolRec");
            domClass.add(div, this.parent.lightTheme ? 'lightThemeBorder' : 'darkThemeBorder');

            var div1 = domConstruct.create("div", {}, div);
            domClass.add(div1, "SATcolRecBar");

            var div2 = domConstruct.create("div", {
              innerHTML: num
            }, div1);
            domClass.add(div2, "SATcolRecNum");
            domStyle.set(div2, "backgroundColor", this.parent.config.activeColor);
            on(div2, "click", lang.hitch(this, this._zoomToLocation, loc));

            if (distLbl) {
              var div3 = domConstruct.create("div", {
                innerHTML: distLbl
              }, div1);
              domClass.add(div3, "SATcolDistance");
            }

            if (this.parent.config.enableRouting) {
              var div4 = domConstruct.create("div", { title: this.parent.nls.get_directions }, div1);
              domClass.add(div4, "SATcolDir");
              on(div4, "click", lang.hitch(this, this._routeToIncident, loc));
            }

            var div5 = domConstruct.create("div", {
              'class': 'SATcolWrap',
              innerHTML: info
            }, div);
            domClass.add(div5, "SATcolInfo");

            _w += domGeom.position(div).w;

            var sls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              new Color.fromRgb(this.parent.config.activeMapGraphicColor), 1);
            var sms = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 24, sls,
              new Color.fromRgb(this.parent.config.activeMapGraphicColor));
            var fnt = new Font();
            fnt.family = "Arial";
            fnt.size = "12px";
            var symText = new TextSymbol(num, fnt, new esriColor(this.parent.config.fontColor));
            symText.setOffset(0, -4);
            this.graphicsLayer.add(new Graphic(loc, sms, attr));
            this.graphicsLayer.add(new Graphic(loc, symText, attr));
          }
        }
      }

      if (!snapShot && hasResults) {
        domStyle.set(tpc, 'width', _w);
      } else {
        if (hasResults) {
          def.resolve({
            graphics: results,
            analysisResults: analysisResults,
            context: this
          });
          return def;
        }
      }
    },

    _exportToCSV: function (results, snapShot, downloadAll, analysisResults) {
      var pi = {
        type: 'closest',
        baseLabel: this.baseLabel,
        csvAllFields: this.parent.config.csvAllFields,
        layer: this.tab.tabLayers[0],
        opLayers: this.parent.opLayers,
        nlsValue: this.parent.nls.closest,
        nlsCount: this.parent.nls.count
      };
      var res = analysisUtils.exportToCSV(results, snapShot, downloadAll, analysisResults, pi);
      this.summaryLayer = res.summaryLayer;
      return res.details;
    },

    _getFields: function (layer) {
      var fieldDetails = analysisUtils.getFields(layer, this.tab, this.allFields, this.parent);
      this.dateFields = fieldDetails.dateFields;
      this.specialFields = fieldDetails.specialFields;
      this.typeIdField = fieldDetails.typeIdField;
      this.types = fieldDetails.types;
      this.displayFields = analysisUtils.getDisplayFields(this.tab);
      return fieldDetails.fields;
    },

    _zoomToLocation: function (loc) {
      this.parent.zoomToLocation(loc);
    },

    _routeToIncident: function (loc) {
      this.parent.routeToIncident(loc);
    }
  });

  return closestInfo;

});
