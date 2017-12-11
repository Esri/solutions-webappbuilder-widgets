///////////////////////////////////////////////////////////////////////////
// Copyright 2015 Esri. All Rights Reserved.
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
   'dojo/_base/array',
   'dojo/_base/event',
   'dojo/_base/lang',
   'dojo/_base/Color',
   'dojo/_base/html',
   'dojo/DeferredList',
   'dojo/dom-class',
   'dojo/dom',
   'dojox/gfx/fx',
   'dojo/on',
   'dojo/Evented',
   'jimu/utils',
   'esri/layers/GraphicsLayer',
   'esri/graphic',
   'esri/geometry/Extent',
   'esri/geometry/Point',
   'esri/symbols/PictureMarkerSymbol',
   'esri/symbols/SimpleMarkerSymbol',
   'esri/symbols/SimpleLineSymbol',
   'esri/symbols/TextSymbol',
   'esri/symbols/Font',
   'esri/renderers/SimpleRenderer',
   'esri/tasks/query',
   'esri/tasks/QueryTask',
   'esri/symbols/jsonUtils',
   'esri/renderers/jsonUtils',
   'esri/layers/FeatureLayer'
], function (declare,
  array,
  dojoEvent,
  lang,
  Color,
  html,
  DeferredList,
  domClass,
  dom,
  fx,
  on,
  Evented,
  utils,
  GraphicsLayer,
  Graphic,
  Extent,
  Point,
  PictureMarkerSymbol,
  SimpleMarkerSymbol,
  SimpleLineSymbol,
  TextSymbol,
  Font,
  SimpleRenderer,
  Query,
  QueryTask,
  jsonUtils,
  renderUtils,
  FeatureLayer) {
  var clusterLayer = declare('ClusterLayer', [GraphicsLayer, Evented], {
    //TODO change size breaks to equal interval eg. breaks = (max - min) / numRanges;
    constructor: function (options) {
      //Defaults
      this.clusterGraphics = [];
      this.cancelRequest = false;
      this.clusterSize = 120;
      this._singles = [];
      this._showSingles = true;
      this.updateFeatures = undefined;

      //Options
      this.hidePanel = options.hidePanel;
      this._parent = options._parent;
      this._parentLayer = options.parentLayer;
      if (this._parentLayer) {
        this.objectIdField = this._parentLayer.objectIdField;
        this.fields = this._parentLayer.fields;
      }
      this.name = options.name;
      this._map = options.map;
      this.color = Color.fromString(options.color || '#ff0000');
      this._styleColor = options._styleColor;
      this.symbolData = options.lyrInfo.symbolData;
      this.countColor = this.symbolData._highLightColor;
      this.itemId = options.lyrInfo.itemId;
      this.refresh = options.lyrInfo.refresh;
      this.displayFeatureCount = this.symbolData.displayFeatureCount;
      this.node = options.node;
      this.countEnabled = options.countEnabled;
      this.legendNode = options.legendNode;
      this.id = options.id;
      this.infoTemplate = options.infoTemplate;
      this.url = options.lyrInfo.url;
      this._testRenderer = options.lyrInfo.renderer;
      this.originOperLayer = options.originOperLayer;
      if (this.originOperLayer) {
        this._getInfoTemplate(this.originOperLayer);
      }
      this.lyrInfo = options.lyrInfo;
      this.lyrType = options.lyrType;
      this.filter = options.filter;
      this.showAllFeatures = options.showAllFeatures;
      this.listDisabled = options.listDisabled;
      this.selfType = options.selfType;

      this._setupSymbols();
      this._setFieldNames();
      this.countFeatures(this._parentLayer);

      if(this._parentLayer.refreshInterval > 0) {
        setInterval(lang.hitch(this, this._updateEnd), this._parentLayer.refreshInterval * 60000);
      }
    },

    countFeatures: function (lyr) {
      //Query the features based on map extent for supported layer types
      var q = new Query();
      q.geometry = !this.showAllFeatures ? this._map.extent : lyr.fullExtent;
      if (lyr.queryCount) {
        lyr.queryCount(q, lang.hitch(this, function (r) {
          if (r > 0) {
            //Feature collection layers with no features
            // throw an error that I can't seem to catch when you
            //apply a where clause such as "1=1"
            if (!this.hidePanel) {
              this.nodeCount = r;
            }
            this._initFeatures(this._parentLayer);
          }
          else {
            if (!this.hidePanel) {
              this.nodeCount = 0;
              var fl = new FeatureLayer(lyr.url);
              on(fl, "load", lang.hitch(this, function () {
                this.countFeatures(fl);
              }));
            }
          }
        }));
      } else {
        this._initFeatures(this._parentLayer);
      }
    },

    _initFeatures: function (lyr) {
      this._features = [];
      var loading = true;
      var q = new Query();
      var staticLayers = ["CSV", "Feature Collection", "GeoRSS", "KML"];
      if ((staticLayers.indexOf(this.lyrType) > -1 || !this.url) && lyr.graphics) {
        this._getSourceFeatures(lyr.graphics);
        this.clusterFeatures();
      } else if (typeof (this.url) !== 'undefined') {
        this.loadData(this.url);
      } else {
        q.where = (!this.showAllFeatures && this.filter) ? this.filter : "1=1";
        q.outFields = ['*'];
        q.returnGeometry = true;
        if (lyr.queryFeatures) {
          lyr.queryFeatures(q).then(lang.hitch(this, function (results) {
            if (results.features) {
              this._getSourceFeatures(results.features);
              this.clusterFeatures();
            }
          }));
        } else {
          loading = "error";
        }
      }
      if (loading !== "error") {
        if (!this.extentChangeSignal) {
          this.extentChangeSignal = this._map.on('extent-change', lang.hitch(this, this.handleMapExtentChange));
        }
        if (!this.clickSignal) {
          this.clickSignal = this.on('click', lang.hitch(this, this.handleClick));
        }
      }
    },

    _getSourceFeatures: function (features) {
      this._features = [];
      for (var i = 0; i < features.length; i++) {
        var g = features[i];
        if (g.geometry) {
          this._features.push(g);
        }
      }
    },

    //this is a duplicate of what's in settings...as the infoTemplate passed from settings was not being honored
    // for MapServer sublayers...works fine without this for hosted layers
    _getInfoTemplate: function (originOpLayer) {
      var l;
      if (originOpLayer.parentLayerInfo) {
        l = originOpLayer.parentLayerInfo;
      } else {
        l = originOpLayer;
      }
      if (l.controlPopupInfo) {
        var infoTemplates = l.controlPopupInfo.infoTemplates;
        if (infoTemplates) {
          if (this.url) {
            var subLayerId = this.url.split("/").pop();
            if (subLayerId) {
              if (infoTemplates.indexOf) {
                if (infoTemplates.indexOf(subLayerId) > -1) {
                  this.infoTemplate = infoTemplates[subLayerId].infoTemplate;
                }
              } else if (infoTemplates.hasOwnProperty(subLayerId)) {
                this.infoTemplate = infoTemplates[subLayerId].infoTemplate;
              }
            }
          }
          this.setInfoTemplate(this.infoTemplate);
        }
      }
    },

    _setFieldNames: function () {
      this._fieldNames = [];
      //this will limit the fields to those fequired for the popup
      if (this.infoTemplate) {
        if (typeof (this.infoTemplate.info) !== 'undefined') {
          var fieldInfos = this.infoTemplate.info.fieldInfos;
          if (fieldInfos) {
            for (var i = 0; i < fieldInfos.length; i++) {
              if (fieldInfos[i].visible) {
                this._fieldNames.push(fieldInfos[i].fieldName);
              }
            }
          }
        }
      }
      if (this.symbolData.featureDisplayOptions) {
        if (this.symbolData.featureDisplayOptions.fields.length > 0) {
          for (var ii = 0; ii < this.symbolData.featureDisplayOptions.fields.length; ii++) {
            var f = this.symbolData.featureDisplayOptions.fields[ii];
            if (this._fieldNames.indexOf(f.name) === -1) {
              this._fieldNames.push(f.name);
            }
          }
        }
      }
      if (this._fieldNames.length < 1) {
        //get all fields
        this._fieldNames = ["*"];
      }
    },

    setLayerInfo: function(lyrInfo){
      this.lyrInfo = lyrInfo;
    },

    clearSingles: function (singles) {
      // Summary:  Remove graphics that represent individual data points.
      var s = singles || this._singles;
      array.forEach(s, function (g) {
        this.remove(g);
      }, this);
      this._singles.length = 0;
    },

    _getSingleGraphic: function (p) {
      var g = new Graphic(
        new Point(p.geometry.x, p.geometry.y, this._map.spatialReference),
        null,
        p.attributes
      );
      g.setSymbol(this._singleSym);
      return g;
    },

    _addSingles: function (singles) {
      array.forEach(singles, function (p) {
        var g = this._getSingleGraphic(p);
        this._singles.push(g);
        if (this._showSingles) {
          this.add(g);
        }
      }, this);
      this._map.infoWindow.setFeatures(this._singles);
    },

    initalCount: function (url) {
      if (!this.hidePanel) {
        var q = new Query();
        q.returnGeometry = false;
        q.geometry = !this.showAllFeatures ? this._map.extent : null;
        q.where = (!this.showAllFeatures && this.filter) ? this.filter : "1=1";
        var qt = new QueryTask(url);
        qt.executeForIds(q).then(lang.hitch(this, function (results) {
          var updateNode;
          if (this.node) {
            if (domClass.contains(this.node, 'searching')) {
              domClass.remove(this.node, 'searching');
            }
            this.node.innerHTML = results ? utils.localizeNumber(results.length) : 0;
            updateNode = this.node.parentNode;
          } else {
            if (this.legendNode) {
              updateNode = this.legendNode.previousSibling;
            }
          }
          this.updateExpand(updateNode, results ? false : true);
        }));
      }
    },

    updateExpand: function (node, hide) {
      if (!this.hidePanel) {
        if (typeof (node) !== 'undefined') {
          var id;
          var en;
          if (node.id.indexOf('rec_') > -1) {
            id = node.id.replace('rec_', '');
            en = dom.byId("exp_" + id);
          }
          if (hide) {
            if (node) {
              html.addClass(node, "recDefault");
              html.addClass(node, "inActive");
            }
            if (en) {
              html.addClass(en, "expandInActive");
            }
          } else {
            if (this.visible) {
              if (node) {
                html.removeClass(node, "recDefault");
                html.removeClass(node, "inActive");
              }
              if (en) {
                html.removeClass(en, "expandInActive");
              }
            }
          }
        }
      }
    },

    loadData: function (url) {
      if (url.length > 0) {
        this.initalCount(url);
        var q = new Query();
        q.where = "1=1";
        if (!this.showAllFeatures && this.filter) {
          q.where = this.filter;
        }
        q.returnGeometry = false;
        this.queryPending = true;
        var qt = new QueryTask(url);
        qt.executeForIds(q).then(lang.hitch(this, function (results) {
          var max = 1000;
          if (results) {
            this.queryIDs = results;
            var queries = [];
            var i, j;
            for (i = 0, j = this.queryIDs.length; i < j; i += max) {
              var ids = this.queryIDs.slice(i, i + max);

              var _q = new Query();
              _q.outFields = ['*'];
              _q.objectIds = ids;
              _q.returnGeometry = true;
              _q.outSpatialReference = this._map.spatialReference;
              var _qt = new QueryTask(url);
              queries.push(_qt.execute(_q));
            }

            this._features = [];
            if (!this.cancelRequest) {
              var queryList = new DeferredList(queries);
              queryList.then(lang.hitch(this, function (queryResults) {
                this.queryPending = false;
                if (!this.cancelRequest) {
                  if (queryResults) {
                    var sr = this._map.spatialReference;
                    var fs = [];
                    for (var i = 0; i < queryResults.length; i++) {
                      if (queryResults[i][1].features) {
                        for (var ii = 0; ii < queryResults[i][1].features.length; ii++) {
                          var item = queryResults[i][1].features[ii];
                          if (typeof (item.geometry) !== 'undefined' && item.geometry !== null && item.geometry) {
                            var geom = new Point(item.geometry.x, item.geometry.y, sr);
                            var gra = new Graphic(geom);
                            gra.setAttributes(item.attributes);
                            if (this.infoTemplate) {
                              gra.setInfoTemplate(this.infoTemplate);
                            }
                            fs.push(gra);
                          }
                        }
                      }
                    }

                    //TODO...figure out a better test here JSON.stringify does not like itwhen you have too many features
                    //it fell over with 150,000 for sure have not really tested it out too far
                    var shouldUpdate = true;
                    if (fs < 10000) {
                      shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
                    }
                    if (shouldUpdate) {
                      this.requiresReload = true;
                      this._features = fs;
                      this.clusterFeatures();

                      this.emit("update-end",{
                        bubbles: true,
                        cancelable: true
                      });

                    }
                  }
                } else {
                  console.log("Cancelled ClusterLayer 2");
                }
              }));
            } else {
              console.log("Cancelled ClusterLayer 1");
            }
          }
        }));
      }
    },

    //click
    handleClick: function (event) {
      var singles = [];
      if (event.graphic) {
        var g = event.graphic;
        if (g.attributes) {
          var attr = g.attributes;
          if (attr.Data && attr.Data.length > 1) {
            this.clearSingles(this._singles);
            singles = attr.Data;
            event.stopPropagation();
            this._addSingles(singles);
          } else if (attr.Data && attr.Data.length === 1) {
            attr.Data[0].symbol = g.symbol;
            this._map.infoWindow.setFeatures([attr.Data[0]]);
          } else {
            this._map.infoWindow.setFeatures([g]);
          }
        }
      }
      if (this.infoTemplate) {
        this._map.infoWindow.show(event.mapPoint);
      }
      dojoEvent.stop(event);
    },

    //re-cluster on extent change
    handleMapExtentChange: function (event) {
      if (event.levelChange) {
        this.clusterFeatures();
      } else if (event.delta) {
        var delta = event.delta;
        var dx = Math.abs(delta.x);
        var dy = Math.abs(delta.y);
        if (dx > 50 || dy > 50) {
          this.clusterFeatures();
        }
      }
    },

    refreshFeatures: function (responseLayer) {
      if (this.itemId) {
        var responseFeatureSetFeatures = responseLayer.featureSet.features;
        if (typeof (this.updateFeatures) === 'undefined') {
          this.updateFeatures = responseFeatureSetFeatures;
        }
        var shouldUpdate = true;
        if (responseFeatureSetFeatures.length < 10000) {
          shouldUpdate = JSON.stringify(this.updateFeatures) !== JSON.stringify(responseFeatureSetFeatures);
        }

        if (shouldUpdate) {
          this.requiresReload = true;

          //if valid response then clear and load
          this._features = [];
          this._parentLayer.clear();
          var sr = this._parentLayer.spatialReference;
          var r;
          if (this._parentLayer.renderer) {
            r = this._parentLayer.renderer;
          } else if (this._testRenderer) {
            r = this._testRenderer;
          }
          for (var ii = 0; ii < responseFeatureSetFeatures.length; ii++) {
            var item = responseFeatureSetFeatures[ii];
            if (item.geometry) {
              var gra = new Graphic(this.getGraphicOptions(item, sr, r));
              gra.setAttributes(item.attributes);
              if (this.infoTemplate) {
                gra.setInfoTemplate(this.infoTemplate);
              }
              gra.setSymbol(r.getSymbol(gra));
              this._parentLayer.add(gra);
              this._features.push(gra);

            } else {
              console.log("Null geometry skipped");
            }
          }
          this.clusterFeatures();
        }
        this.updateFeatures = responseFeatureSetFeatures;
      } else if (this.url) {
        this.loadData(this.url);
      }
    },

    getGraphicOptions: function (item, sr, renderer) {
      var graphicOptions;
      if (typeof (item.geometry.rings) !== 'undefined') {
        graphicOptions = {
          geometry: {
            rings: item.geometry.rings,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else if (typeof (item.geometry.paths) !== 'undefined') {
        graphicOptions = {
          geometry: {
            paths: item.geometry.paths,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else if (typeof (item.geometry.points) !== 'undefined') {
        graphicOptions = {
          geometry: {
            points: item.geometry.points,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else {
        graphicOptions = {
          geometry: new Point(item.geometry.x, item.geometry.y, item.geometry.spatialReference),
          symbol: renderer.symbol
        };
      }
      return graphicOptions;
    },

    flashFeatures: function () {
      this._map.graphics.clear();
      this.flashGraphics(this.graphics);
    },

    flashSingle: function (graphic) {
      if (typeof (graphic.symbol) === 'undefined') {
        var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        var symColor = this.color.toRgb();
        graphic.setSymbol(new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9,
          cls2, new Color([symColor[0], symColor[1], symColor[2], 0.5])));
      }
      this.flashGraphics([graphic]);
    },

    flashGraphics: function (graphics) {
      for (var i = 0; i < graphics.length; i++) {
        var g = graphics[i];
        this._flashFeature(g);
      }
      setTimeout(lang.hitch(this, this._clearFeatures), 1100);
    },

    _flashFeature: function (feature) {
      var symbol;
      if (feature.geometry) {
        var color = Color.fromHex(this._styleColor);
        var color2 = lang.clone(color);
        color2.a = 0.4;
        if (typeof (feature.symbol) !== 'undefined') {
          symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, feature.symbol.size,
            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
            color, 1),
            color2);
        }
      }
      if (typeof (symbol) !== 'undefined') {
        var g = new Graphic(feature.geometry, symbol);
        this._map.graphics.add(g);
        var dShape = g.getDojoShape();
        if (dShape) {
          fx.animateStroke({
            shape: dShape,
            duration: 700,
            color: {
              start: dShape.strokeStyle.color,
              end: dShape.strokeStyle.color
            },
            width: {
              start: 18,
              end: 0
            }
          }).play();
          setTimeout(this._clearFeature, 850, g);
        }
      }
    },

    _clearFeatures: function () {
      this._map.graphics.clear();
    },

    _clearFeature: function (f) {
      var gl = f.getLayer();
      gl.remove(f);
    },

    setColor: function (color) {
      this.color = color;
    },

    setStyleColor: function(color){
      this._styleColor = color;
    },

    cancelPendingRequests: function () {
      console.log("Cancel Query...");
      if (this.queryPending) {
        this.cancelRequest = true;
      }
      this.removeEventListeners();
    },

    removeEventListeners: function () {
      if (this.extentChangeSignal) {
        this.extentChangeSignal.remove();
        this.extentChangeSignal = null;
      }
      if (this.clickSignal) {
        this.clickSignal.remove();
        this.clickSignal = null;
      }
    },

    // cluster features
    clusterFeatures: function () {
      this.clear();
      if (this._map === null) {
        this._map = this._parent.map;
      }
      if (this._map.infoWindow.isShowing) {
        this._map.infoWindow.hide();
      }
      var features = this._features;
      var total = 0;
      if (typeof (features) !== 'undefined') {
        if (features.length > 0 && (this.visible || this.requiresReload)) {
          var clusterSize = this.clusterSize;
          this.clusterGraphics = [];
          var sr = this._map.spatialReference;
          var mapExt = this._map.extent;
          var o = new Point(mapExt.xmin, mapExt.ymax, sr);

          var rows = Math.ceil(this._map.height / clusterSize);
          var cols = Math.ceil(this._map.width / clusterSize);
          var distX = mapExt.getWidth() / this._map.width * clusterSize;
          var distY = mapExt.getHeight() / this._map.height * clusterSize;

          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              var x1 = o.x + (distX * c);
              var y2 = o.y - (distY * r);
              var x2 = x1 + distX;
              var y1 = y2 - distY;

              var ext = new Extent(x1, y1, x2, y2, sr);

              var cGraphics = [];
              for (var i in features) {
                var feature = features[i];
                if (ext.contains(feature.geometry)) {
                  total += 1;
                  cGraphics.push(feature);
                }
              }
              if (cGraphics.length > 0) {
                var cPt = this.getClusterCenter(cGraphics);
                this.clusterGraphics.push({
                  center: cPt,
                  graphics: cGraphics
                });
              }
            }
          }

          //add cluster to map
          for (var g in this.clusterGraphics) {
            var clusterGraphic = this.clusterGraphics[g];
            var count = clusterGraphic.graphics.length;
            var data = clusterGraphic.graphics;
            var label = utils.localizeNumber(count);
            var size = label.length * 19;
            var size2 = size;
            size += 5;

            var fnt = new Font();
            fnt.family = "Arial";
            fnt.size = "16px";
            var symText = new TextSymbol(label, fnt, this.countColor);
            symText.setOffset(0, -4);

            var testSize;
            if (this.symbolData && this.symbolData.symbol) {
              if (this.symbolData.symbol.size) {
                testSize = this.symbolData.symbol.size;
              } else if (this.symbolData.symbol.width) {
                var w = this.symbolData.symbol.width;
                var h = this.symbolData.symbol.height;
                testSize = w >= h ? w : h;
              }
            } else if (this.icon.width) {
              size = this.icon.width >= size ? this.icon.width + 5: size;
              size = this.icon.height >= size ? this.icon.height + 5: size;
              size2 = this.icon.width >= size2 ? this.icon.width + 1: size2;
              size2 = this.icon.height >= size2 ? this.icon.height + 1: size2;
            } else if (this.icon.size) {
              testSize = this.icon.size;
            }

            if (testSize) {
              size = testSize >= size ? testSize + 5 : size;
              size2 = testSize >= size2 ? testSize + 1 : size2;
            }

            if (size2 >= size) {
              size += size2 - size === 0 ? 4 : (size2 - size) + 5;
            }

            this._setSymbols(size + 15, size);

            var attr = {
              Count: count,
              Data: data
            };
            if (count > 1) {
              if (typeof (this.symbolData) !== 'undefined') {
                if (this.symbolData.symbolType !== 'CustomSymbol') {
                  this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                  if (this.displayFeatureCount) {
                    this.add(new Graphic(clusterGraphic.center, symText, attr));
                  } else {
                    this.add(new Graphic(clusterGraphic.center, this.csym3, attr));
                  }
                } else {
                  this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                  if (this.displayFeatureCount) {
                    this.add(new Graphic(clusterGraphic.center, symText, attr));
                  } else {
                    this.add(new Graphic(clusterGraphic.center, this.psym, attr));
                  }
                }
              } else {
                this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                if (this.displayFeatureCount) {
                  this.add(new Graphic(clusterGraphic.center, symText, attr));
                } else {
                  this.add(new Graphic(clusterGraphic.center, this.psym, attr));
                }
              }
            } else {
              var pt = clusterGraphic.graphics[0].geometry;
              var _g;
              if (this.renderer) {
                if (this.renderer.hasOwnProperty("getSymbol") && this.symbolData.symbolType === "LayerSymbol") {
                  _g = new Graphic(pt, null, attr.Data[0].attributes, this.infoTemplate);
                  _g.setSymbol(this.renderer.getSymbol(_g));
                } else if (this.renderer.hasOwnProperty("symbol") && this.symbolData.symbolType === "LayerSymbol") {
                  _g = new Graphic(pt, null, attr.Data[0].attributes, this.infoTemplate);
                  _g.setSymbol(jsonUtils.fromJson(this.renderer.symbol));
                } else if (this.symbolData.symbolType === "EsriSymbol") {
                  _g = new Graphic(pt, jsonUtils.fromJson(this.symbolData.symbol), attr, this.infoTemplate);
                } else if (this.symbolData.symbolType !== "LayerSymbol") {
                  _g = new Graphic(pt, this.psym, attr, this.infoTemplate);
                } else {
                  if (this.renderer.symbol) {
                    _g = new Graphic(pt, this.renderer.symbol, attr, this.infoTemplate);
                  } else {
                    _g = new Graphic(pt, this.psym, attr, this.infoTemplate);
                  }
                }
                if (typeof (_g) !== 'undefined') {
                  this.add(_g);
                }
              }
            }
          }
        }
        this._updateNode(this.showAllFeatures ? features.length : total);
      }
    },

    _getSym: function (graphic) {
      var symbol;
      if (this.renderer.hasOwnProperty("getSymbol") && this.symbolData.symbolType === "LayerSymbol") {
        symbol = this.renderer.getSymbol(graphic);
      } else if (this.renderer.hasOwnProperty("symbol") && this.symbolData.symbolType === "LayerSymbol") {
        symbol = this.renderer.symbol;
      } else if (this.symbolData.symbolType === "EsriSymbol") {
        symbol = this.symbolData.symbol;
      } else if (this.symbolData.symbol) {
        symbol = this.symbolData.symbol;
      }
      return symbol;
    },

    _updateNode: function (total) {
      if (!this.hidePanel) {
        var updateNode;
        if (this.node) {
          this.node.innerHTML = utils.localizeNumber(total ? total : 0);
          updateNode = this.node.parentNode;
        } else {
          if (this.legendNode) {
            updateNode = this.legendNode.previousSibling;
          }
        }
        this.updateExpand(updateNode, (total && total > 0) && this.visible ? false : true);
      }
    },

    _updatePanelTime: function (modifiedTime) {
      if (!this.hidePanel) {
        var dFormat = {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        };
        this.pageTitle.innerHTML = "<div></div>";
        var updateValue = "";
        if (this.config.mainPanelText !== "") {
          updateValue = this.config.mainPanelText + " ";
        }

        this.pageTitle.innerHTML = updateValue + new Date(modifiedTime).toLocaleDateString(navigator.language, dFormat);
      }
    },

    _setSymbols: function (size, size2) {
      var symColor = this.color.toRgb();
      var fsp;
      var style;
      var lineWidth;
      if (typeof (this.symbolData) !== 'undefined') {
        var c;
        //need to make a marker from the fill properties
        if (this.backgroundClusterSymbol === "custom") {
          c = symColor;
        } else {
          fsp = jsonUtils.fromJson(this.backgroundClusterSymbol);

          if (fsp.outline.color.a === 0 || fsp.outline.width === 0) {
            style = SimpleLineSymbol.STYLE_NULL;
            lineWidth = 0;
          } else {
            style = SimpleLineSymbol.STYLE_SOLID;
            lineWidth = fsp.outline.width;
          }
        }

        if (fsp) {
          var cls = SimpleLineSymbol(style, fsp.outline.color, lineWidth);
          c = fsp.color.toRgb();
          this.csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE,
            size, cls, new Color([c[0], c[1], c[2], 0.75]));
        } else {
          this.csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE,
            size, null, new Color([c[0], c[1], c[2], 0.75]));
        }

        var path = this.symbolData.s;
        if (path && path.indexOf("${appPath}") > -1) {
          var pathName = window.location.pathname.replace('index.html', '');
          path = this.symbolData.s.replace("${appPath}", window.location.origin + pathName);
        } else if (this.symbolData.s) {
          path = this.symbolData.s;
        } else {
          path = this.icon.imageData;
        }
        if (path && this.symbolData.iconType === "CustomIcon") {
          var _h, _w;
          if (this.symbolData.symbol && this.symbolData.symbol.height) {
            _h = this.symbolData.symbol.height;
          }
          if (this.symbolData.symbol && this.symbolData.symbol.width) {
            _w = this.symbolData.symbol.width;
          }
          if (_h && _w) {
            _h = _w > _h ? _w : _h;
            _w = _h;
          } else {
            _h = this.symbolData.icon.height ? this.symbolData.icon.height : size2;
            _w = this.symbolData.icon.width ? this.symbolData.icon.width : size2;
          }
          this.psym = new PictureMarkerSymbol(path, _h, _w);
        } else if (path && this.symbolData.iconType === "LayerIcon") {
          this.psym = jsonUtils.fromJson(this.symbolData.symbol);
        } else {
          if (this.icon.type === 'esriPMS') {
            this.psym = this.icon;
          } else {
            var sls = SimpleLineSymbol(this.icon.outline.style,
              this.icon.outline.color, this.icon.outline.width);
            this.psym = new SimpleMarkerSymbol(this.icon.style, this.icon.size,
              sls, this.icon.color);
          }
        }

        //options for cluster with 1
        this.csym2 = lang.clone(this.psym);
        this.csym3 = lang.clone(this.csym2);
        if (typeof (this.csym2.xoffset) !== 'undefined') {
          this.csym3.xoffset = 0;
        }
        if (typeof (this.csym2.yoffset) !== 'undefined') {
          this.csym3.yoffset = 0;
        }
      } else {
        //options for cluster with more than 1
        var cls1 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL,
          new Color(0, 0, 0, 0), 0);
        this.csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size,
          cls1, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
        this.psym = new PictureMarkerSymbol(this.icon.url, size - 10, size - 10);

        //options for cluster with 1
        this.psym2 = new PictureMarkerSymbol(this.icon.url, size2 - 7, size2 - 7);
        var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        this.csym2 = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size2,
          cls2, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
      }
    },

    _setupSymbols: function () {
      if (typeof (this.symbolData) !== 'undefined') {
        this.countColor = this.symbolData._highLightColor;
        this.backgroundClusterSymbol = this.symbolData.clusterSymbol;
        this.icon = this.symbolData.icon;
        if (this.symbolData.symbolType === "LayerSymbol") {
          if (this._parentLayer.renderer) {
            if (this._parentLayer.renderer.toJson) {
              this.renderer = this._parentLayer.renderer;
            } else {
              this.renderer = renderUtils.fromJson(this._parentLayer.renderer);
            }
          } else if (this._testRenderer) {
            this.renderer = renderUtils.fromJson(this._testRenderer);
          } else if (this.symbolData.renderer) {
            if (this.symbolData.renderer.toJson) {
              this.renderer = this.symbolData.renderer;
            } else {
              this.renderer = renderUtils.fromJson(this.symbolData.renderer);
            }
          }
        } else {
          this.renderer = new SimpleRenderer(jsonUtils.fromJson(this.symbolData.symbol));
        }
        var symColor = this.color.toRgb();
        var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        this._singleSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, cls,
          new Color([symColor[0], symColor[1], symColor[2], 0.5]));
      }
    },

    getLayer: function(){
      return this;
    },

    getClusterCenter: function (graphics) {
      var xSum = 0;
      var ySum = 0;
      var count = graphics.length;
      array.forEach(graphics, function (graphic) {
        xSum += graphic.geometry.x;
        ySum += graphic.geometry.y;
      }, this);
      var cPt = new Point(xSum / count, ySum / count, graphics[0].geometry.spatialReference);
      return cPt;
    },

    destroy: function () {
      this._clear();
      this.removeEventListeners();
    },

    _clear: function () {
      this.clear();
      this._features = [];
    },

    _updateEnd: function () {
      if (this.url) {
        this.loadData(this.url);
      }
    }

  });

  return clusterLayer;
});
