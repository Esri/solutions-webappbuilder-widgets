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
  'esri/graphic',
  'esri/Color',
  'esri/layers/FeatureLayer',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/Font',
  'esri/symbols/TextSymbol',
  'esri/tasks/query',
  'esri/geometry/geometryEngine',
  'jimu/utils',
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
  Graphic,
  esriColor,
  FeatureLayer,
  SimpleMarkerSymbol,
  SimpleLineSymbol,
  Font,
  TextSymbol,
  Query,
  geometryEngine,
  utils,
  analysisUtils
) {

  var proximityInfo = declare('ProximityInfo', null, {

    featureCount: 0,
    mapServiceLayer: false,
    loading: false,
    queryOnLoad: false,
    incidentCount: 0,

    //https://devtopia.esri.com/john4818/arcgis-webappbuilder/commit/b67ed01748addd7e9b0f6689d42a31db93feac45

    constructor: function (tab, container, parent) {
      this.tab = tab;
      this.container = container;
      this.parent = parent;
      this.incident = null;
      this.graphicsLayer = null;
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

    queryTabCount: function (incidents, buffers, updateNode, displayCount) {
      var def = new Deferred();
      this.incidentCount = incidents.length;
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
                  this.tab.tabLayers = [tempFL];
                  this.loading = false;
                  this._performQuery(incidents, buffers, updateNode, displayCount,
                    this.tab.tabLayers).then(function (r) {
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

    _performQuery: function (incidents, buffers, updateNode, displayCount, tabLayers) {
      var def = new Deferred();
      var defArray = [];
      var geom;
      var prevArray;
      var da;
      var geoms;
      if (buffers.length > 0) {
        geoms = analysisUtils.getGeoms(buffers);
      } else if (incidents.length > 0) {
        geoms = analysisUtils.getGeoms(incidents);
      }
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
            length += featureSet;
          } else if (featureSet && featureSet.features) {
            length += featureSet.features.length;
          } else if (featureSet && typeof (featureSet.length) !== 'undefined') {
            length += featureSet.length;
          }
        }
        this.updateTabCount(length, updateNode, displayCount);
        def.resolve(length);
      }));
      return def;
    },

    updateTabCount: function (count, updateNode, displayCount) {
      this.featureCount = count;
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
        if (tab.url) {
          var tempFL = new FeatureLayer(tab.url, { mode: FeatureLayer.MODE_ONDEMAND, infoTemplate: tab.infoTemplate });
          on(tempFL, "load", lang.hitch(this, function () {
            this.tab.tabLayers = [tempFL];
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

    processIncident: function (incidents, buffers, graphicsLayer, snapShot) {
      this.incidents = incidents;
      var inc_buffers = [];
      var incident, geom;
      if (buffers.length === 0) {
        for (var l = 0; l < incidents.length; l++) {
          incident = incidents[l];
          geom = incident.geometry ? incident.geometry : incident;
          //when no buffers only consider polygon incidents
          if (geom.type === 'polygon') {
            buffers.push(geom);
            inc_buffers.push({ geometry: geom, buffer: geom });
          } else {
            inc_buffers.push({ geometry: undefined, buffer: undefined });
          }
        }
      } else {
        for (var k = 0; k < incidents.length; k++) {
          incident = incidents[k];
          var bufferGeom = buffers[k].geometry ? buffers[k].geometry : buffers[k];
          geom = incident.geometry ? incident.geometry : incident;
          inc_buffers.push({ geometry: geom, buffer: bufferGeom });
        }
      }
      if (buffers.length === 0) {
        return;
      }

      for (var j = 0; j < inc_buffers.length; j++) {
        var geom1 = inc_buffers[j].buffer;
        if (typeof (geom1) !== 'undefined') {
          for (var jj = 0; jj < inc_buffers.length; jj++) {
            if (jj !== j) {
              var geom2 = inc_buffers[jj].buffer;
              if (typeof (geom2) !== 'undefined') {
                var intersects = geometryEngine.overlaps(geom1, geom2);
                if (intersects) {
                  //subtract geom2 from geom1
                  inc_buffers[j].buffer = geometryEngine.difference(geom1, geom2);
                  //subtract geom1 from geom2
                  inc_buffers[jj].buffer = geometryEngine.difference(geom2, geom1);
                  //union geom1 and geom2
                  var union = geometryEngine.union(geom2, geom1);
                  //subtract geom1 from union
                  union = geometryEngine.difference(union, inc_buffers[j].buffer);
                  //subtract geom2 from union
                  union = geometryEngine.difference(union, inc_buffers[jj].buffer);
                  var geomTests;
                  if (Array.isArray(inc_buffers[j].geometry)) {
                    if (Array.isArray(inc_buffers[jj].geometry)) {
                      for (var z = 0; z < inc_buffers[jj].geometry.length; z++) {
                        inc_buffers[j].geometry.push(inc_buffers[jj].geometry[z]);
                      }
                    } else {
                      inc_buffers[j].geometry.push(inc_buffers[jj].geometry);
                    }
                    geomTests = inc_buffers[j].geometry;
                  } else {
                    geomTests = [];
                    geomTests.push(inc_buffers[j].geometry);
                    if (Array.isArray(inc_buffers[jj].geometry)) {
                      for (var zz = 0; zz < inc_buffers[jj].geometry.length; zz++) {
                        geomTests.push(inc_buffers[jj].geometry[zz]);
                      }
                    } else {
                      geomTests.push(inc_buffers[jj].geometry);
                    }
                  }
                  var newGeomPair = {
                    geometry: geomTests,
                    buffer: union
                  };
                  inc_buffers.push(newGeomPair);
                }
              }
            }
          }
        }
      }

      var def;
      var isSnapShot = typeof (snapShot) !== 'undefined';
      if (!isSnapShot) {
        this.container.innerHTML = "";
        domClass.add(this.container, "loading");
      } else {
        def = new Deferred();
      }
      var results = [];
      this.graphicsLayer = graphicsLayer;
      var layer = this.tab.tabLayers[0];
      var fields = this._getFields(layer);
      var defArray = [];
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
        if(typeof(layer.queryFeatures) !== 'undefined'){
          defArray.push(layer.queryFeatures(query));
        }
      }
      var defList = new DeferredList(defArray);
      defList.then(lang.hitch(this, function (defResults) {
        for (var r = 0; r < defResults.length; r++) {
          var featureSet = defResults[r][1];
          if (featureSet && featureSet.features) {
            var graphics = featureSet.features;
            var inc_geom = inc_buffers[r].geometry;
            for (var g = 0; g < graphics.length; g++) {
              var gra = graphics[g];
              var geom = gra.geometry;

              var newAttr;
              var dist;
              if (Array.isArray(inc_geom)) {
                var dist_;
                for (var c = 0; c < inc_geom.length; c++) {
                  var _dist = analysisUtils.getDistance(inc_geom[c], geom, this.parent.config.distanceUnits);
                  if (typeof (dist_) === 'undefined' || _dist < dist_) {
                    dist_ = _dist;
                  }
                }
                dist = dist_;
                newAttr = {
                  DISTANCE: dist_
                };
              } else {
                dist = analysisUtils.getDistance(inc_geom, geom, this.parent.config.distanceUnits);
                newAttr = {
                  DISTANCE: dist
                };
              }

              for (var f = 0; f < fields.length; f++) {
                newAttr[fields[f]] = gra.attributes[fields[f]];
              }
              if (this.config.csvAllFields === true || this.config.csvAllFields === "true") {
                //do nothing.  All fields in graphic will export.
                gra.attributes.DISTANCE = dist;
              } else {
                gra.attributes = newAttr;
              }
              results.push(gra);
            }
          }
        }
        //The distances are calculated from the originating incident/buffer pair
        // but are sorted at one time so result features 1,2,4,7 may be in incident 1
        // while result features 3,5,6,8 may be in incident 2
        results.sort(analysisUtils.compareDistance);
        if (!isSnapShot) {
          this._processResults(results);
        } else {
          var finalResults = {
            graphics: results,
            analysisResults: results.length,
            context: this
          };
          this._processResults(results, true).then(lang.hitch(this, function (reportResults) {
            def.resolve(lang.mixin(finalResults, reportResults));
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

    _processResults: function (results, report) {
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

      if (report) {
        def = new Deferred();
      } else {
        this.container.innerHTML = "";
        domClass.remove(this.container, "loading");
        this.graphicsLayer.clear();
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
      var displayFields;
      if (typeof (this.tab.advStat) !== 'undefined' &&
        typeof (this.tab.advStat.stats) !== 'undefined' &&
        typeof (this.tab.advStat.stats.outFields) !== 'undefined') {
        displayFields = this.tab.advStat.stats.outFields;
      } else {
        displayFields = [];
        if (this.tab.tabLayers.length > 0) {
          var mapLayers = this.tab.tabLayers;
          array.forEach(mapLayers, lang.hitch(this, function (layer) {
            //if (layer.title === this.tab.layers || layer.name === this.tab.layers) {
            if(typeof(layer.popupInfo) !== 'undefined') {
              array.forEach(layer.popupInfo.fieldInfos, lang.hitch(this, function (field) {
                if (field.visible) {
                  var fieldObj = {};
                  fieldObj.value = 0;
                  fieldObj.expression = field.fieldName;
                  fieldObj.label = field.label;
                  displayFields.push(fieldObj);
                }
              }));
            } else if (layer.infoTemplate) {
              array.forEach(layer.infoTemplate.info.fieldInfos, lang.hitch(this, function (field) {
                if (field.visible) {
                  var fieldObj = {};
                  fieldObj.value = 0;
                  fieldObj.expression = field.fieldName;
                  fieldObj.label = field.label;
                  displayFields.push(fieldObj);
                }
              }));
            }
            else {
              var l = layer.layerObject ? layer.layerObject : layer;
              array.forEach(l.fields, lang.hitch(this, function(field) {
                var fieldObj = {};
                fieldObj.value = 0;
                fieldObj.expression = field.name;
                fieldObj.label = field.alias;
                displayFields.push(fieldObj);
              }));
            }
            //}
          }));
        }
      }

      var _w = 220;
      var reportResults = [];
      if(hasResults){
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
          if (typeof (displayFields) !== 'undefined') {
            for (var ij = 0; ij < displayFields.length; ij++) {
              var field = displayFields[ij];
              for (var prop in attr) {
                if (prop !== "DISTANCE" && c < 3) {
                  if (field.expression === prop) {
                    var fVal = analysisUtils.getFieldValue(prop, attr[prop], this.specialFields,
                      this.dateFields, 'longMonthDayYear', this.typeIdField, this.types);
                    var value;
                    if (typeof (fVal) !== 'undefined' && fVal !== null) {
                      value = utils.stripHTML(fVal.toString());
                    } else {
                      value = "";
                    }
                    var label;
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
                    row.push({ label: label, value: value });
                  }
                }
              }
            }
            if (row.length > 0) {
              reportResults.push(row);
            }
          }

          if (!report) {
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
              new Color.fromString(this.parent.config.activeMapGraphicColor), 1);
            var sms = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 24, sls,
              new Color.fromString(this.parent.config.activeMapGraphicColor));
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
      if (!report && hasResults) {
        domStyle.set(tpc, 'width', _w + 'px');
      } else {
        def.resolve({
          reportResults: reportResults
        });
        return def;
      }
    },

    _exportToCSV: function (results, snapShot, downloadAll, analysisResults) {
      var pi = {
        type: 'proximity',
        baseLabel: this.baseLabel,
        csvAllFields: this.parent.config.csvAllFields,
        layer: this.tab.tabLayers[0],
        opLayers: this.parent.opLayers,
        nlsValue: this.parent.nls.proximity,
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

  return proximityInfo;

});
