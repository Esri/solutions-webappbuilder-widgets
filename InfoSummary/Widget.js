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
/*jshint loopfunc: true */
define(['jimu/BaseWidget',
'jimu/LayerInfos/LayerInfos',
'jimu/utils',
'dojo/dom',
'dojo/dom-class',
'dojo/dom-construct',
'dojo/on',
'dojo/dom-style',
'dojo/_base/declare',
'dojo/_base/lang',
'dojo/_base/html',
'dojo/_base/Color',
'dojo/promise/all',
'dojo/_base/array',
'dojo/DeferredList',
'dojo/Deferred',
'dojo/query',
"dojox/gfx/fx",
'dojox/gfx',
'dojo/_base/xhr',
'dijit/_WidgetsInTemplateMixin',
'esri/graphic',
'esri/geometry/Point',
'esri/symbols/SimpleMarkerSymbol',
'esri/symbols/PictureMarkerSymbol',
'esri/symbols/SimpleLineSymbol',
'esri/symbols/SimpleFillSymbol',
'esri/Color',
'esri/tasks/query',
'esri/tasks/QueryTask',
"esri/tasks/FeatureSet",
"esri/arcgis/utils",
'esri/symbols/jsonUtils',
'esri/request',
"esri/renderers/SimpleRenderer",
"esri/renderers/jsonUtils",
'./js/ClusterLayer',
'esri/layers/LayerDrawingOptions'
],
function (BaseWidget,
  LayerInfos,
  utils,
  dom,
  domClass,
  domConstruct,
  on,
  domStyle,
  declare,
  lang,
  html,
  dojoColor,
  all,
  array,
  DeferredList,
  Deferred,
  query,
  fx,
  gfx,
  xhr,
  _WidgetsInTemplateMixin,
  Graphic,
  Point,
  SimpleMarkerSymbol,
  PictureMarkerSymbol,
  SimpleLineSymbol,
  SimpleFillSymbol,
  Color,
  Query,
  QueryTask,
  FeatureSet,
  arcgisUtils,
  jsonUtils,
  esriRequest,
  SimpleRenderer,
  jsonUtil,
  ClusterLayer,
  LayerDrawingOptions
  ) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-InfoSummary',

    name: "InfoSummary",
    opLayerInfos: null,
    layerList: {},
    UNIQUE_APPEND_VAL_CL: "_CL",
    widgetChange: false,
    refreshInterval: 0,
    refreshIntervalValue: 0,
    configLayerInfos: [],
    legendNodes: [],
    currentQueryList: [],
    symbols: [],
    row: null,

    postCreate: function () {
      this.inherited(arguments);
      this.inPanelOverrides(this.appConfig.theme.name);
      this.configLayerInfos = this.config.layerInfos;
      this.layerList = {};
      //populates this.layerInfos and creates the panel
      this._initWidget();
    },

    _forceClose: function () {
      var themeName = this.appConfig.theme.name;
      var dcThemes = ['LaunchpadTheme', 'DartTheme', 'FoldableTheme',
        'JewelryBoxTheme', 'BillboardTheme', 'TabTheme', 'DashboardTheme'];
      var p = this.getPanel();
      if (dcThemes.indexOf(themeName) > -1) {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        this.widgetManager.closeWidget(this.id);
      } else if (themeName === 'BoxTheme') {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        if (p.getParent && p.getParent()._toggleBox) {
          var ss = query('.icon-node-active');
          for (var i = 0; i < ss.length; i++) {
            if (ss[i].outerHTML.indexOf(this.id) > -1) {
              p.getParent()._toggleBox();
            }
          }
        }
      } else if (themeName === 'PlateauTheme') {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        this.widgetManager.closeWidget(this.id);
        if (!this.aw) {
          var widgets = this.widgetManager.appConfig.widgetOnScreen.widgets;
          for (var ii = 0; ii < this.widgetManager.appConfig.widgetOnScreen.widgets.length; ii++) {
            if (widgets[ii].isThemeWidget) {
              this.aw = this.widgetManager.getWidgetById(widgets[ii].id);
              this.aw._switchNodeToClose(this.id);
              this.aw._closeDropMenu();
              break;
            }
          }
        } else {
          this.aw._switchNodeToClose(this.id);
          this.aw._closeDropMenu();
        }
      }
    },

    inPanelOverrides: function (themeName) {
      if (typeof (this.iconClickHandler) !== 'undefined') {
        this.iconClickHandler.remove();
        this.iconClickHandler = undefined;
      }

      var p = this.getPanel();

      if (this.config.hidePanel) {
        var iconNodeThemes = ['DartTheme', 'BoxTheme', 'FoldableTheme', 'JewelryBoxTheme', 'PlateauTheme'];

        var iconNodes;
        if (themeName === 'LaunchpadTheme') {
          this._forceClose();
          iconNodes = query('.selected');
          if (iconNodes.length > 0) {
            if (iconNodes[0].parentNode.outerHTML.indexOf(this.id) > -1) {
              this.iconClickHandler = on(iconNodes[0], 'click', lang.hitch(this, this._forceClose));
            }
          }
        } else if (iconNodeThemes.indexOf(themeName) > -1) {
          if (themeName === 'BoxTheme') {
            this._forceClose(); //did this for box...make sure it doesn't jack others up
          }
          iconNodes = query('.icon-node');
          for (var i = 0; i < iconNodes.length; i++) {
            if (iconNodes[i].outerHTML.indexOf(this.id) > -1) {
              this.iconClickHandler = on(iconNodes[i], 'click', lang.hitch(this, this._forceClose));
            }
          }
        }
      } else {
        //TODO test if this has the class .jimu-widget-frame.jimu-container
        if (p.containerNode && p.containerNode.firstChild && p.containerNode.firstChild.className) {
          p.containerNode.firstChild.style.padding = '0px 0px 10px 0px';
        }

        //change associated with the tab theme...all others will show the background color behind refresh text and panel image
        if (['TabTheme', 'BillboardTheme', 'PlateauTheme', 'DashboardTheme'].indexOf(themeName) === -1) {
          this._updateBackgroundColors(true);
        }

        this.isDartTheme = themeName === "DartTheme";
        this.isDashboardTheme = themeName === 'DashboardTheme';
        if (domClass.contains(this.pageHeader, this.isDartTheme ? 'pageHeader-border' : 'pageHeader-border-dart')) {
          domClass.remove(this.pageHeader, this.isDartTheme ? 'pageHeader-border' : 'pageHeader-border-dart');
        }
        domClass.add(this.pageHeader, this.isDartTheme ? 'pageHeader-border-dart' : 'pageHeader-border');

        switch (themeName) {
          case 'DartTheme':
            this.updateForDartTheme(p);
            break;
          case 'BoxTheme':
            this.updateForBoxTheme(p);
            break;
          case 'TabTheme':
            this.updateForTabTheme(p);
            break;
          case 'LaunchpadTheme':
            this.updateForLaunchpadTheme(p);
            break;
          case 'BillboardTheme':
            this.updateForBillboardTheme(p);
            break;
          case 'PlateauTheme':
            this.updateForPlateauTheme(p);
            break;
          case 'DashboardTheme':
            this.updateForDashboardTheme(p);
            break;
        }
      }
    },

    updateForLaunchpadTheme: function (p) {
      p.containerNode.style.top = '30px';
    },

    updateForTabTheme: function (p) {
      if (p.containerNode.children.length > 0) {
        var fc = p.containerNode.children[0];
        if (fc.children.length > 1) {
          fc.children[1].style.padding = '14px 0px 14px 0px';
        }
      }
      if (!p.config.isOnScreen) {
        this._updateBackgroundColors(false);
      }
    },

    updateForBoxTheme: function (p) {
      p.containerNode.parentNode.style.top = '140px';
    },

    updateForDartTheme: function (p) {
      p.containerNode.style.right = '0px';
      p.containerNode.style.left = '0px';
    },

    updateForBillboardTheme: function () {
      this._updateBackgroundColors(false);
    },

    updateForPlateauTheme: function () {
      this._updateBackgroundColors(false);
    },

    updateForDashboardTheme: function () {
      this._updateBackgroundColors(false);
    },

    _updateBackgroundColors: function (add) {
      //deal with text color
      if (domClass.contains(this.lastUpdated, add ? 'lastUpdated-tab' : 'lastUpdated')) {
        domClass.remove(this.lastUpdated, add ? 'lastUpdated-tab' : 'lastUpdated');
      }
      domClass.add(this.lastUpdated, add ? 'lastUpdated' : 'lastUpdated-tab');

      add = add && this.appConfig.theme.name !== 'DashboardTheme';
      this.useDarkText = !add;

      //deal with background color for page header
      if (domClass.contains(this.pageHeader, 'jimu-main-background') && !add) {
        domClass.remove(this.pageHeader, 'jimu-main-background');
      } else if (!domClass.contains(this.pageHeader, 'jimu-main-background') && add) {
        domClass.add(this.pageHeader, 'jimu-main-background');
      }
      if (domClass.contains(this.pageHeader, 'dart-bgcolor') && !add) {
        domClass.remove(this.pageHeader, 'dart-bgcolor');
      } else if (!domClass.contains(this.pageHeader, 'dart-bgcolor') && add) {
        domClass.add(this.pageHeader, 'dart-bgcolor');
      }
      if (domClass.contains(this.pageHeader, 'box-bgcolor') && !add) {
        domClass.remove(this.pageHeader, 'box-bgcolor');
      } else if (!domClass.contains(this.pageHeader, 'box-bgcolor') && add) {
        domClass.add(this.pageHeader, 'box-bgcolor');
      }
    },

    startup: function () {
      this.inherited(arguments);
      if (!this.hidePanel && !this.showAllFeatures) {
        this.mapExtentChangedHandler = this.map.on("extent-change", lang.hitch(this, this._mapExtentChange));
        this._mapExtentChange();
      } else if (this.showAllFeatures) {
        this._mapExtentChange();
      }
    },

    onOpen: function () {
      this.widgetChange = false;

      if (!this.hidePanel) {
        this._updatePanelHeader();
      } else {
        if (this.appConfig.theme.name !== 'BoxTheme') {
          this._forceClose();
        }
      }
      if (this.appConfig.theme.styles && this.appConfig.theme.styles[0]) {
        this._updateStyleColor(this.appConfig.theme.styles[0]);
      }

      var visibleSubLayers = [];
      //update the renderer for the layer in the layer list if a new one has been defined
      for (var key in this.layerList) {
        var layerListLayer = this.layerList[key];
        var li = layerListLayer.li;
        var lo = layerListLayer.layerObject;
        if (li && li.orgRenderer) {
          if (lo.setRenderer) {
            lo.setRenderer(li.newRenderer);
          } else if (lo.setLayerDrawingOptions) {
            var optionsArray = [];
            var drawingOptions = new LayerDrawingOptions();
            drawingOptions.renderer = li.newRenderer;
            optionsArray[li.subLayerId] = drawingOptions;
            lo.setLayerDrawingOptions(optionsArray);
          } else {
            console.log("Error setting the new renderer...will use the default rendering of the layer");
          }
          if (typeof (lo.refresh) === 'function') {
            lo.refresh();
          }
        }

        var _Pl;
        if (lo && lo.layerInfos) {
          _Pl = lo;
        } else if (li && typeof (li.parentLayerID) !== 'undefined') {
          _Pl = this.map.getLayer(li.parentLayerID);
        }

        var l;
        if (_Pl && _Pl.visibleLayers) {
          var _foundIt = false;
          sub_layers_id_loop:
          for (var ii = 0; ii < visibleSubLayers.length; ii++) {
            var subVizLyrId = visibleSubLayers[ii].id;
            if (subVizLyrId === _Pl.id) {
              _foundIt = true;
              break sub_layers_id_loop;
            }
          }
          if (visibleSubLayers.length === 0 || !_foundIt) {
            visibleSubLayers.push({
              id: _Pl.id,
              layers: _Pl.visibleLayers
            });
          }
          var x = 0;
          subLayerLoop:
          for (x; x < visibleSubLayers.length; x++) {
            var o = visibleSubLayers[x];
            if (o.id === _Pl.id) {
              break subLayerLoop;
            }
          }
          var visLayers = visibleSubLayers[x].layers;
          if (_Pl.layerInfos) {
            //Handle MapService layers
            if (_Pl.layerInfos.length > 0) {
              if (li && typeof (li.subLayerId) !== 'undefined') {
                var inVisLayers = visLayers.indexOf(li.subLayerId) > -1;
                var plVis = layerListLayer.parentLayerVisible;
                var loPlVis = layerListLayer.layerObject.parentLayerVisible;
                if (layerListLayer.type === "ClusterLayer" && (inVisLayers || plVis || loPlVis)) {
                  layerListLayer.parentLayerVisible = true;
                  layerListLayer.layerObject.parentLayerVisible = true;
                  layerListLayer.visible = true;
                  if (inVisLayers) {
                    visLayers.splice(visLayers.indexOf(li.subLayerId), 1);
                  }
                } else if (inVisLayers || plVis) {
                  layerListLayer.parentLayerVisible = true;
                  layerListLayer.visible = true;
                  if (visLayers.indexOf(li.subLayerId) === -1) {
                    visLayers.push(li.subLayerId);
                  }
                }else {
                  layerListLayer.parentLayerVisible = false;
                  layerListLayer.visible = false;
                  if (inVisLayers) {
                    visLayers.splice(visLayers.indexOf(li.subLayerId), 1);
                  }
                  if (layerListLayer.type === "ClusterLayer") {
                    layerListLayer.layerObject.parentLayerVisible = false;
                    if (this.map.graphicsLayerIds.indexOf(layerListLayer.id) > -1) {
                      l = this.map.getLayer(layerListLayer.id);
                      l.setVisibility(false);
                    }
                  }
                }
              }
            }
            visibleSubLayers[x].layers = visLayers;
          }
          this.updatePanelVisibility(layerListLayer, key, layerListLayer);
        } else if (lo) {
          //Handle non MapService layers
          if (layerListLayer.type === "ClusterLayer") {
            if (lo._parentLayer) {
              if (this.map.graphicsLayerIds.indexOf(layerListLayer.id) > -1) {
                l = this.map.getLayer(layerListLayer.id);
                if (typeof (layerListLayer.layerObject.parentLayerVisible) === 'undefined') {
                  layerListLayer.parentLayerVisible = lo._parentLayer.visible;
                  layerListLayer.layerObject.parentLayerVisible = lo._parentLayer.visible;
                }
                l.setVisibility(layerListLayer.layerObject.parentLayerVisible);
              }
              if (lo._parentLayer.setVisibility) {
                lo._parentLayer.setVisibility(false);
              }
            }
          }
          this.updatePanelVisibility(lo, key, layerListLayer);
        }

        if (this.showAllFeatures && this.config.expandList && layerListLayer.legendOpen && !layerListLayer.isLoaded) {
          var visScaleRange = this._inVisibleRange(layerListLayer, key);
          if (layerListLayer.visible && visScaleRange) {
            layerListLayer.updateList = true;
          }
        }
      }

      for (var i = 0; i < visibleSubLayers.length; i++) {
        var parentLayer = this.map.getLayer(visibleSubLayers[i].id);
        if (parentLayer) {
          parentLayer.setVisibleLayers(visibleSubLayers[i].layers);
        }
      }

      if (!this.hidePanel && !this.showAllFeatures) {
        if (typeof (this.mapExtentChangedHandler) === 'undefined') {
          this.mapExtentChangedHandler = this.map.on("extent-change", lang.hitch(this, this._mapExtentChange));
          this._mapExtentChange();
        }
      }

      //if refresh is enabled set refereshInterval on any widget source layers with refresh set to true
      //and call setInterval to refresh the static graphics
      if (this.config.refreshEnabled) {
        this.enableRefresh();
      }

      if (this.map.infoWindow) {
        this.map.infoWindow.highlight = true;
      }
    },

    updatePanelVisibility: function (lo, key, layerListLayer) {
      if (!this.hidePanel) {
        if (typeof (lo.visible) !== 'undefined') {
          var visScaleRange = this._inVisibleRange(layerListLayer, key);
          var c = dom.byId("recLabel_" + key);
          if (!lo.visible) {
            if (domClass.contains("recIcon_" + key, "active")) {
              domClass.remove("recIcon_" + key, "active");
            }
            if (this.config.countEnabled) {
              if (domClass.contains("recNum_" + key, "recNum")) {
                domClass.remove("recNum_" + key, "recNum");
                domClass.add("recNum_" + key, "recNumInActive");
              }
            }
            if (c && c.firstChild) {
              domClass.add(c.firstChild, "inActive");
            }
            if (!layerListLayer.listDisabled) {
              if (!domClass.contains("exp_" + key, "expandInActive")) {
                domClass.add("exp_" + key, "expandInActive");
              }
              layerListLayer.toggleLegend.remove();
            }
            if (domClass.contains("rec_" + key, "rec")) {
              domClass.add("rec_" + key, "recDefault");
            }
          } else {
            if (!domClass.contains("recIcon_" + key, "active")) {
              domClass.add("recIcon_" + key, "active");
            }
            if (this.config.countEnabled) {
              if (domClass.contains("recNum_" + key, "recNumInActive")) {
                domClass.remove("recNum_" + key, "recNumInActive");
                domClass.add("recNum_" + key, "recNum");
              }
            }
            if (c && c.firstChild) {
              domClass.remove(c.firstChild, "inActive");
            }
            if (!layerListLayer.listDisabled) {
              if (typeof(visScaleRange) === 'undefined' || visScaleRange) {
                if (domClass.contains("exp_" + key, "expandInActive")) {
                  domClass.remove("exp_" + key, "expandInActive");
                }
              }
            }
            if (domClass.contains("rec_" + key, "recDefault")) {
              domClass.remove("rec_" + key, "recDefault");
            }
          }
        }
      }
    },

    enableRefresh: function () {
      //set refreshItereval on all widget source layers that support it
      var layerListLayer = null;
      var checkedTime = false;
      for (var key in this.layerList) {
        layerListLayer = this.layerList[key];
        if (layerListLayer.type !== "ClusterLayer") {
          if (!checkedTime && layerListLayer.li) {
            if (layerListLayer.li.itemId) {
              this.getItem(layerListLayer.li.itemId);
              checkedTime = true;
            }
          }
          layerListLayer = layerListLayer.layerObject;
        } else {
          for (var i = 0; i < this.layerInfos.length; i++) {
            var l = this.layerInfos[i];
            if (l.layerObject) {
              layerListLayer = l.layerObject;
              break;
            }
          }
        }
        if (layerListLayer) {
          layerListLayer.refreshInterval = this.config.refreshInterval;
        }
      }

      var tempVal = this.config.refreshInterval * 60000;
      if (this.refreshInterval === 0 && this.refreshIntervalValue === 0) {
        //set the refresh interval based on the configs interval value
        this.refreshIntervalValue = tempVal;
        this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.refreshIntervalValue));
      } else if (this.refreshIntervalValue !== 0 && (this.refreshIntervalValue !== tempVal)) {
        //clear and update the refresh interval if the configs refresh interval has changed
        this.refreshIntervalValue = tempVal;
        clearInterval(this.refreshInterval);
        this.refreshInterval = 0;
        this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.refreshIntervalValue));
      }
    },

    getItem: function (id) {
      var portalUrl = window.portalUrl.substr(-1) !== '/' ? window.portalUrl += '/' : window.portalUrl;
      var url = portalUrl + "sharing/rest/content/items/" + id;
      esriRequest({
        url: url,
        content: {
          f: "json",
          requestTime: Date.now()
        }
      }).then(lang.hitch(this, function (response) {
        if (response) {
          var itemModified = response.modified;
          var update = true;
          if (this.lastModifiedTime) {
            update = this.lastModifiedTime < itemModified;
          }
          if (this.currentQueryList.indexOf(id) > -1) {
            this.currentQueryList.splice(this.currentQueryList.indexOf(id), 1);
          }
          if (update) {
            this.lastModifiedTime = itemModified;
            this._updatePanelTime(itemModified);
            esriRequest({
              url: url + '/data',
              content: {
                f: "json",
                requestTime: Date.now()
              }
            }).then(lang.hitch(this, this._updateItem, id));
          }
        }
      }));
    },

    _updatePanelTime: function (modifiedTime) {
      if (!this.hidePanel) {
        this.lastUpdated.innerHTML = "<div></div>";
        var _d = new Date(modifiedTime);
        var _f = { dateFormat: 'shortDateShortTime' };
        this.lastUpdated.innerHTML = utils.fieldFormatter.getFormattedDate(_d, _f);
      }
    },

    refreshLayers: function () {
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        var id;
        if (lyr.li && lyr.li.itemId) {
          id = lyr.li.itemId;
        } else if (lyr.layerObject.itemId) {
          id = lyr.layerObject.itemId;
        }

        if (id) {
          if (this.currentQueryList.indexOf(id) === -1) {
            this.currentQueryList.push(id);
            this.getItem(id);
          }
        }
      }
    },

    _updateItem: function (id, response) {
      var featureCollection = response;
      for (var i = 0; i < featureCollection.layers.length; i++) {
        this._updateLayerItem(featureCollection.layers[i], this.lastModifiedTime);
      }
      this.currentQueryList.splice(this.currentQueryList.indexOf(id), 1);
    },

    //TDOO ensure this functions as expected when filter by map extent id disabled
    _updateLayerItem: function (responseLayer) {
      var layerListLayer;
      var parentLayer;
      var list, fields;
      for (var k in this.layerList) {
        var lyr = this.layerList[k];
        if (lyr.pl && lyr.pl.layerDefinition) {
          if (lyr.pl.layerDefinition.name === responseLayer.layerDefinition.name) {
            layerListLayer = lyr;
            parentLayer = lyr.pl;
            break;
          }
        } else if (lyr.layerObject._parentLayer) {
          if (lyr.layerObject._parentLayer.name === responseLayer.layerDefinition.name) {
            list = typeof (lyr.listDisabled) !== 'undefined' ? lyr.listDisabled : false;
            fields = lyr.li.symbolData.featureDisplayOptions.fields &&
              lyr.li.symbolData.featureDisplayOptions.fields.length > 0;
            if (!list && fields) {
              lyr.isLoaded = false;
            }
            lyr.layerObject.refreshFeatures(responseLayer);
            if (lyr.layerObject) {
              this._loadList(lyr, true);
            }
          }
        } else if (lyr.pl && lyr.pl.name) {
          if (lyr.pl.name === responseLayer.layerDefinition.name) {
            layerListLayer = lyr;
            parentLayer = lyr.pl;
            break;
          }
        }
      }

      if (responseLayer && layerListLayer && parentLayer && (parentLayer.featureSet || parentLayer.graphics)) {
        var responseFeatureSetFeatures = responseLayer.featureSet.features;

        var mapFeatureSetFeatures;
        if (parentLayer.featureSet) {
          mapFeatureSetFeatures = parentLayer.featureSet.features;
        } else {
          mapFeatureSetFeatures = [];
          var responseSR = this._getSpatialReference(responseFeatureSetFeatures);
          var mapSR = this._getSpatialReference(parentLayer.graphics);
          array.forEach(parentLayer.graphics, function (gra) {
            var g = gra.geometry;
            var geom = g.rings ? { rings: g.rings } : g.paths ? { paths: g.paths } :
              g.points ? { points: g.points } : (g.x && g.y) ? { x: g.x, y: g.y } : {};
            if (geom !== {}) {
              mapFeatureSetFeatures.push({
                attributes: gra.attributes,
                geometry: lang.mixin({
                  spatialReference: (responseSR && mapSR && responseSR.wkid === mapSR.wkid) ? responseSR : mapSR
                }, geom)
              });
            }
          });
        }

        //var transform;
        //if (responseLayer.featureSet.transform) {
        //  transform = responseLayer.featureSet.transform;
        //  //var fs = new FeatureSet(JSON.stringify(responseLayer.featureSet.features));
        //}

        var shouldUpdate = true;
        //TODO Figure out a better test for larger responses
        if (responseFeatureSetFeatures.length < 10000) {
          shouldUpdate = JSON.stringify(mapFeatureSetFeatures) !== JSON.stringify(responseFeatureSetFeatures);
        }

        if (shouldUpdate) {
          list = typeof (layerListLayer.listDisabled) !== 'undefined' ? layerListLayer.listDisabled : false;
          fields = layerListLayer.li.symbolData.featureDisplayOptions.fields &&
            layerListLayer.li.symbolData.featureDisplayOptions.fields.length > 0;
          if (!list && fields) {
            layerListLayer.isLoaded = false;
            layerListLayer.requiresReload = true;
          }
          if (list) {
            layerListLayer.li.layerListExtentChanged = true;
          }
          layerListLayer.layerObject.clear();
          var sr = layerListLayer.layerObject.spatialReference;
          for (var j = 0; j < responseFeatureSetFeatures.length; j++) {
            var item = responseFeatureSetFeatures[j];
            if (item.geometry) {
              //check li for renderer also
              var go = this.getGraphicOptions(item, sr, layerListLayer.layerObject.renderer);
              var gra = new Graphic(go);
              gra.setSymbol(go.symbol);
              gra.setAttributes(item.attributes);
              if (this._infoTemplate) {
                gra.setInfoTemplate(this._infoTemplate);
              }
              layerListLayer.layerObject.add(gra);
            } else {
              console.log("Null geometry skipped");
            }
          }
          layerListLayer.layerObject.refresh();
          if (parentLayer.featureSet) {
            parentLayer.featureSet.features = responseFeatureSetFeatures;
          }
          this.countFeatures(layerListLayer);
          if (layerListLayer.layerObject && layerListLayer.layerObject.visible) {
            this._loadList(layerListLayer, true);
          }
        }
      }
    },

    _getSpatialReference: function (features) {
      var sr;
      if (features && features.hasOwnProperty('length') && features.length > 0) {
        var firstFeature = features[0];
        if (firstFeature.geometry && firstFeature.geometry.spatialReference) {
          sr = firstFeature.geometry.spatialReference;
        }
      }
      return sr;
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

    _initWidget: function () {
      this.hidePanel = typeof (this.config.hidePanel) !== 'undefined' ? this.config.hidePanel : false;
      this.showAllFeatures = typeof (this.config.showAllFeatures) !== 'undefined' ? this.config.showAllFeatures : false;
      if (this.map.itemId) {
        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this.wmLayerInfos = operLayerInfos.getLayerInfoArrayOfWebmap();
            this.layerInfos = operLayerInfos.getLayerInfoArray();
            this.operLayerInfos = operLayerInfos;
            this._updateLayerIDs();
            if (this.config.upgradeFields) {
              this._upgradeFields();
            }
            this._createPanelUI(this.configLayerInfos, operLayerInfos);
            this._addFilterChanged(operLayerInfos);
            this._addVisibleChanged(operLayerInfos);
            this._addZoomChanged(operLayerInfos);
          }));
      }
    },

    _updateLayerIDs: function () {
      var removeIDs = [];
      config_layer_loop:
      for (var i = 0; i < this.configLayerInfos.length; i++) {
        var configLayer = this.configLayerInfos[i];
        var jimuLayerInfo = this.operLayerInfos.getLayerInfoById(configLayer.id);

        //If we cannot find the jimu layer info based on the stored ID we need to determine it
        if (!jimuLayerInfo) {
          var updated = false;
          wm_layer_loop:
          for (var ii = 0; ii < this.wmLayerInfos.length; ii++) {
            var _opLayer = this.wmLayerInfos[ii];
            var originOpLayer = _opLayer ? _opLayer.originOperLayer : undefined;

            var urlId = this._compareURL(originOpLayer, configLayer);
            var itemId = this._compareItemID(originOpLayer, configLayer);
            var subId = this._compareSubId(_opLayer, configLayer);

            var id = urlId ? urlId : itemId ? itemId : subId ? subId : undefined;
            jimuLayerInfo = id ? this.operLayerInfos.getLayerInfoById(id) : jimuLayerInfo;

            if (jimuLayerInfo) {
              this.configLayerInfos[i].id = jimuLayerInfo.id;
              this.configLayerInfos[i].layer = jimuLayerInfo.id;
              updated = true;
              break wm_layer_loop;
            }
          }

          if (!updated && !jimuLayerInfo) {
            removeIDs.push(i);
          }
        }
      }

      //This needs to occur largest to smallest
      if (removeIDs.length > 0) {
        //removeIDs.sort((a, b) => (b - a));
        removeIDs.sort(function (a, b) { return b - a; });
        array.forEach(removeIDs, lang.hitch(this, function (id) {
          this.configLayerInfos.splice(id, 1);
        }));
      }
    },

    _compareSubId: function (opLayer, configLayer) {
      if (opLayer && opLayer.subId && opLayer.subId.indexOf(configLayer.id) > -1) {
        if (opLayer.layerObject) {
          var geomMatch = this._compareGeom(opLayer.layerObject, configLayer);
          var fieldMatch = this._compareFields(opLayer.layerObject, configLayer);
          if (geomMatch && fieldMatch) {
            return opLayer.subId;
          }
        }
      }
      return undefined;
    },

    _compareItemID: function (originOpLayer, configLayer) {
      if (originOpLayer && originOpLayer.itemId && originOpLayer.itemId === configLayer.itemId) {
        if (originOpLayer.featureCollection && originOpLayer.featureCollection.layers &&
          originOpLayer.featureCollection.layers.hasOwnProperty('length')) {
          var fcLayers = originOpLayer.featureCollection.layers;
          for (var i = 0; i < fcLayers.length; i++) {
            var fcLayer = fcLayers[i];
            if (this._compareGeom(fcLayer, configLayer)){
              if (this._compareFields(fcLayer, configLayer)) {
                return fcLayer.id;
              }
            }
          }
          return undefined;
        } else {
          console.log('error in checking item by itemID');
        }
      }
    },

    _compareURL: function (originOpLayer, configLayer) {
      return (originOpLayer && originOpLayer.url && configLayer.url && originOpLayer.url === configLayer.url) ?
        originOpLayer.id : undefined;
    },

    _compareGeom: function (layerObject, configLayer) {
      return (layerObject && layerObject.geometryType && configLayer.geometryType) ?
        layerObject.geometryType === configLayer.geometryType : undefined;
    },

    _compareFields: function (layerObject, configLayer) {
      var fieldMatch;
      if (layerObject && layerObject.fields && configLayer.fields &&
        layerObject.fields.length === configLayer.fields.length) {
        //test if Names match
        var matchingFields = layerObject.fields.filter(function (f) {
          for (var fn = 0; fn < configLayer.fields.length; fn++) {
            var configField = configLayer.fields[fn];
            if (f.name === configField.name) {
              return f;
            }
          }
        });
        fieldMatch = matchingFields.length === layerObject.fields.length;
      }
      return fieldMatch;
    },

    //added for backwards compatability
    //could not handle directly in VersionManager as some stored layerInfos
    // do not have a valid infoTemplate saved
    _upgradeFields: function () {
      if (this.configLayerInfos) {
        for (var i = 0; i < this.configLayerInfos.length; i++) {
          var li = this.configLayerInfos[i];
          if (li && li.symbolData && li.symbolData.featureDisplayOptions) {
            var lyrInfo = this.operLayerInfos.getLayerInfoById(li.id);
            if (lyrInfo) {
              var fields = li.symbolData.featureDisplayOptions.fields;
              //At previous releases we would use the first field from the infoTemplate or
              //the first non-OID field from the layer if no fields were selected by the user
              if (typeof (fields) === 'undefined' || (fields.hasOwnProperty('length') && fields.length === 0)) {
                //check layer fields
                var layerObject = (lyrInfo && lyrInfo.layerObject) ? lyrInfo.layerObject : undefined;
                var oidFieldName = (layerObject && layerObject.objectIdField) ? layerObject.objectIdField : undefined;
                var firstLayerFieldName = "";
                var firstLayerFieldAlias = "";
                var layerFields = li.fields ? li.fields : layerObject ? layerObject.fields : undefined;
                if (layerFields && layerFields.length > 0) {
                  layer_field_loop:
                  for (var _i = 0; _i < layerFields.length; _i++) {
                    var f = layerFields[_i];
                    if (firstLayerFieldName === "" && f.type !== "esriFieldTypeOID" &&
                      f.type !== "esriFieldTypeGeometry" && f.name !== oidFieldName) {
                      firstLayerFieldName = f.name;
                      firstLayerFieldAlias = f.alias || f.name;
                    }
                    if (!oidFieldName) {
                      oidFieldName = f.type === "esriFieldTypeOID" ? f.name : oidFieldName;
                    }
                    if (oidFieldName && firstLayerFieldName !== "") {
                      break layer_field_loop;
                    }
                  }
                }

                //check popup fields
                var keyFieldName = "";
                var keyFieldAlias = "";
                var infoTemplate = li.infoTemplate && li.infoTemplate.info && li.infoTemplate.info.fieldInfos ?
                  li.infoTemplate : lyrInfo ? lyrInfo.getInfoTemplate() : undefined;
                if (!infoTemplate) {
                  var subLayers = lyrInfo.getSubLayers();
                  sub_layers_loop:
                  for (var sli = 0; sli < subLayers.length; sli++) {
                    var sl = subLayers[sli];
                    if (sl.title && sl.layerObject && sl.layerObject.name && sl.title === sl.layerObject.name) {
                      infoTemplate = sl.getInfoTemplate ? sl.getInfoTemplate() : infoTemplate;
                      break sub_layers_loop;
                    }
                  }
                }
                var popupFields = infoTemplate ? infoTemplate.info.fieldInfos : [];
                popup_field_loop:
                for (var j = 0; j < popupFields.length; j++) {
                  var popupField = popupFields[j];
                  if (popupField && popupField.visible) {
                    if (!oidFieldName || oidFieldName !== popupField.fieldName) {
                      keyFieldName = popupField.fieldName;
                      keyFieldAlias = popupField.label || popupField.fieldName;
                      break popup_field_loop;
                    }
                  }
                }

                //update the config
                this.configLayerInfos[i].symbolData.featureDisplayOptions.fields = [{
                  name: keyFieldName ? keyFieldName : firstLayerFieldName,
                  label: keyFieldName ? keyFieldAlias : firstLayerFieldAlias
                }];
              }
            }
          }
        }
      }
    },

    _addFilterChanged: function (layerInfos) {
      if (parseFloat(this.appConfig.wabVersion) >= 2.1) {
        this.own(layerInfos.on('layerInfosFilterChanged', lang.hitch(this, function (changedLayerInfoArray) {
          array.forEach(changedLayerInfoArray, lang.hitch(this, function (layerInfo) {
            var id = layerInfo.id;
            var clId = layerInfo.id + this.UNIQUE_APPEND_VAL_CL;
            if (this.layerList.hasOwnProperty(id)) {
              this.layerList[id].filter = layerInfo.getFilter();
            } else if (this.layerList.hasOwnProperty(clId)) {
              this.layerList[clId].layerObject.filter = layerInfo.getFilter();
              this.layerList[clId].layerObject._initFeatures();
            }
          }));
        })));
      }
    },

    _updateVisibility: function (layerInfo) {
      if (layerInfo) {
        var id = layerInfo.id;
        var vis = layerInfo.isShowInMap();
        if (this.layerList.hasOwnProperty(id)) {
          var lyr = this.layerList[id];
          if (id === lyr.li.id && lyr.visible !== vis) {
            this._toggleLayerUI(lyr.li, vis);
          } else if (id === lyr.id && lyr.visible !== vis) {
            this._toggleLayerUI(layerInfo, vis);
          }
        }
      }
    },

    _addVisibleChanged: function (layerInfos) {
      this.own(layerInfos.on('layerInfosIsVisibleChanged', lang.hitch(this, function (changedLayerInfos) {
        array.forEach(changedLayerInfos, function (layerInfo) {
          this._updateVisibility(layerInfo);
        }, this);
      })));
    },

    _addZoomChanged: function (layerInfos) {
      this.own(on(this.map, 'zoom-end', lang.hitch(this, function () {
        layerInfos.traversal(lang.hitch(this, function (layerInfo) {
          this._updateVisibility(layerInfo);
        }));
      })));
    },

    _updatePanelHeader: function () {
      var panelTitle;
      var w = this.map.width;
      if (this.config.displayPanelIcon && w > 750) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");

          if (this.config.refreshEnabled) {
            if (this.config.mainPanelText !== "") {
              html.addClass(this.pageHeader, "pageHeaderRefresh");
            } else {
              html.addClass(this.pageHeader, "pageHeaderRefreshNoText");
            }
          } else {
            html.addClass(this.pageHeader, "pageHeader");
          }
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          if (this.config.refreshEnabled) {
            if (this.config.mainPanelText !== "") {
              html.addClass(this.pageBody, "pageBodyRefresh");
            } else {
              html.addClass(this.pageBody, "pageBodyRefreshNoText");
            }
          } else {
            html.addClass(this.pageBody, "pageBody");
          }
        }

        if (this.pageTitle) {
          html.addClass(this.pageTitle, "pageTitleWidth");
          if (this.config.refreshEnabled) {
            html.removeClass(this.pageTitle, "pageTitle");
            html.removeClass(this.pageTitle, "pageTitleRefresh-tab");
            html.removeClass(this.pageTitle, "pageTitleRefresh");
            html.addClass(this.pageTitle, this.useDarkText ? "pageTitleRefresh-tab" : "pageTitleRefresh");
          } else {
            html.removeClass(this.pageTitle, "pageTitleRefresh");
            html.removeClass(this.pageTitle, "pageTitleRefresh-tab");
            html.addClass(this.pageTitle, "pageTitle");
          }
        }

        panelTitle = this.config.mainPanelText;
        if (typeof (panelTitle) === 'undefined') {
          panelTitle = "";
        }
        this.pageTitle.innerHTML = panelTitle;
        this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
      } else if (!this.config.displayPanelIcon && !this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeader");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");
          html.addClass(this.pageHeader, "pageHeaderNoIcon");
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBody");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          html.addClass(this.pageBody, "pageBodyNoIcon");
        }
        this.pageTitle.innerHTML = "<div></div>";
        this.panelMainIcon.innerHTML = "<div></div>";
      } else if (!this.config.displayPanelIcon && this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeader");
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.addClass(this.pageHeader, "pageHeaderNoIconRefresh");
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBody");
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.addClass(this.pageBody, "pageBodyNoIconRefresh");
        }

        if (this.pageTitle) {
          html.removeClass(this.pageTitle, "pageTitleWidth");
        }
        this.pageTitle.innerHTML = "<div></div>";
        this.panelMainIcon.innerHTML = "<div></div>";
      } else if (this.config.displayPanelIcon && w <= 750 && this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");
          html.removeClass(this.pageHeader, "pageHeader");
          if (this.config.mainPanelText !== "") {
            html.addClass(this.pageHeader, "pageHeaderRefresh");
          } else {
            html.addClass(this.pageHeader, "pageHeaderRefreshNoText");
          }
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          html.removeClass(this.pageBody, "pageBody");
          if (this.config.mainPanelText !== "") {
            html.addClass(this.pageBody, "pageBodyRefresh");
          } else {
            html.addClass(this.pageBody, "pageBodyRefreshNoText");
          }
        }

        if (this.pageTitle) {
          html.addClass(this.pageTitle, "pageTitleWidth");
        }

        panelTitle = this.config.mainPanelText;
        if (typeof (panelTitle) === 'undefined') {
          panelTitle = "";
        }
        this.pageTitle.innerHTML = panelTitle;
      }
    },

    _createPanelUI: function (configLayerInfos, jimuLayerInfos) {
      this.numClusterLayers = 0;

      if (!this.hidePanel) {
        this._updatePanelHeader();
        this._updateUI(null);
        this._clearChildNodes(this.pageMain);
        this.updateEnd = [];
      }

      for (var i = 0; i < configLayerInfos.length; i++) {
        var lyrInfo = configLayerInfos[i];
        if (lyrInfo.symbolData.clusterType === 'ThemeCluster') {
          this.updateThemeClusterSymbol(lyrInfo, i);
        }

        var jimuLayerInfo = jimuLayerInfos.getLayerInfoById(lyrInfo.id);
        if (jimuLayerInfo) {
          jimuLayerInfo.getLayerType().then(lang.hitch(this, function (layerType) {
            jimuLayerInfo.getLayerObject().then(lang.hitch(this, function (layerObject) {
              this.updateLayerList(layerObject, lyrInfo, layerType, jimuLayerInfo);
            }));
          }));
        }
      }

      if (!this.hidePanel) {
        for (var k in this.layerList) {
          var lyr = this.layerList[k];
          if (lyr.type !== "ClusterLayer") {
            if (lyr && lyr.layerObject) {
              if (lyr.layerObject.hasOwnProperty('refreshInterval') && lyr.layerObject.refreshInterval > 0) {
                this.updateEnd.push(this.own(on(lyr.layerObject, "update-end", lang.hitch(this, this._updateEnd))));
              }
            }
          }
        }
      }
      this.addMapLayers();
    },

    _updateEnd: function (results) {
      var lid = this.layerList.hasOwnProperty(results.target.id) ? results.target.id :
        this.layerList.hasOwnProperty(results.target.id + "_CL") ? results.target.id + "_CL" : "";

      //For map service with sub layers...the results ID is for the parent layer
      if (lid === "") {
        for (var i in this.layerList) {
          var l = this.layerList[i];
          if (l && l.layerObject && l.layerObject.id === results.target.id) {
            lid = l.li.id;
            break;
          }
        }
      }
      if (this.layerList.hasOwnProperty(lid)) {
        var lyr = this.layerList[lid];
        lyr.isLoaded = false;
        lyr.updating = false;
        lyr.requiresReload = true;
        if (lyr) {
          if (lyr.legendOpen) {
            this._loadList(lyr, this.config.countEnabled);
          } else if (this.config.countEnabled) {
            this.countFeatures(lyr);
          }
        }
      }
    },

    updateThemeClusterSymbol: function(lyrInfo, i){
      var sd = lyrInfo.symbolData;
      if (this.appConfig.theme.styles && this.appConfig.theme.styles[0]) {
        if (typeof (this._styleColor) === 'undefined') {
          this._updateStyleColor(this.appConfig.theme.styles[0]);
        }
      }
      if (this._styleColor) {
        var _rgb = dojoColor.fromHex(this._styleColor);
        var x = i + 1;
        var xx = x > 0 ? x * 30 : 30;
        var evenOdd = x % 2 === 0;
        var r = _rgb.r;
        var g = _rgb.g;
        var b = _rgb.b;

        var rr = r - xx;
        if (evenOdd) {
          if (rr > 255) {
            rr = rr - 255;
          }
          else if (rr < 0) {
            rr = rr + 255;
          }
        }

        var bb = b - xx;
        if (x % 3 === 0) {
          if (evenOdd) {
            if (bb > 255) {
              bb = bb - 255;
            }
            else if (bb < 0) {
              bb = bb + 255;
            }
          }
        }

        var gg = g - xx;
        if (x % 5 === 0) {
          if (evenOdd) {
            if (gg > 255) {
              gg = gg - 255;
            }
            else if (gg < 0) {
              gg = gg + 255;
            }
          }
        }
        sd.clusterType = 'CustomCluster';
        sd.clusterSymbol = {
          color: [rr, gg, bb, 1],
          outline: {
            color: [0, 0, 0, 0],
            width: 0,
            type: "esriSLS",
            style: "esriSLSNull"
          },
          type: "esriSFS",
          style: "esriSFSSolid"
        };
      }
    },

    removeOldClusterLayers: function (lInfos) {
      //check if the widget was previously configured
      // with a layer that it no longer consumes...if so remove it
      var deleteLayers = [];
      for (var id in this.layerList) {
        var l = this.layerList[id];
        if (l.type === "ClusterLayer") {
          layer_info_loop:
          for (var i = 0; i < lInfos.length; i++) {
            var lo = lInfos[i];
            var potentialNewClusterID = lo.id + this.UNIQUE_APPEND_VAL_CL;
            if (potentialNewClusterID === id) {
              if (lo.symbolData && !lo.symbolData.clusteringEnabled) {
                deleteLayers.push(id);
              }
              break layer_info_loop;
            }
          }
        }
      }
      if (deleteLayers.length > 0) {
        for (var dl in deleteLayers) {
          if (this.layerList.hasOwnProperty(deleteLayers[dl])) {
            if (this.map.graphicsLayerIds.indexOf(deleteLayers[dl]) > -1) {
              var _dl = this.layerList[deleteLayers[dl]];
              if (_dl && _dl.li) {
                var jimuLayerInfo;
                if (_dl.li.parentLayerID) {
                  jimuLayerInfo = this.operLayerInfos.getLayerInfoById(_dl.li.parentLayerID);
                }
                if (!jimuLayerInfo && _dl.li.layer) {
                  jimuLayerInfo = this.operLayerInfos.getLayerInfoById(_dl.li.layer);
                }
                if (jimuLayerInfo && _dl.hasOwnProperty('parentLayerVisible')) {
                  jimuLayerInfo.setTopLayerVisible(_dl.parentLayerVisible);
                }
              }
              this.map.removeLayer(this.layerList[deleteLayers[dl]].layerObject);
            }
            this.layerList[deleteLayers[dl]].layerObject.destroy();
            delete this.layerList[deleteLayers[dl]];
          }
        }
      }
    },

    addMapLayers: function () {
      var ids = Object.keys(this.layerList).reverse();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var l = this.layerList[id];
        if (l.type && l.type === "ClusterLayer") {
          if (this.map.graphicsLayerIds.indexOf(id) === -1) {
            this.map.addLayer(l.layerObject);
          }
        }
      }
    },

    updateLayerList: function (lyr, lyrInfo, lyrType, jimuLayerInfo) {
      var l, ll  = null;
      var type, id, layerObject, pl;

      jimuLayerInfo = jimuLayerInfo || this.operLayerInfos.getLayerInfoById(lyr.id);

      var selfType = this._checkSelfType(jimuLayerInfo, lyrInfo, lyrType, lyr);
      var listDisabled = this._checkListDisabled(lyrInfo);

      //Handle cluster layers
      if (lyrInfo.symbolData.clusteringEnabled) {
        l = this._getClusterLayer(lyrInfo, lyr, jimuLayerInfo, lyrType);
        type = "ClusterLayer";
        layerObject = l;
        id = l.id;
        if (!this.hidePanel) {
          this.own(on(l, "update-end", lang.hitch(this, function () {
            this._loadList(this.layerList[l.id], true);
          })));
        }
        this.numClusterLayers += 1;
      } else {
        if (lyr.layerType === "ArcGISStreamLayer") {
          type = "StreamLayer";
          id = lyr.layerObject.id;
          layerObject = lyr.layerObject;
          pl = lyr;
        } else {
          id = lyrType === "FeatureLayer" ? lyrInfo.id : lyr.id;
          var parentLayerInfo = this.operLayerInfos.getLayerInfoById(lyrInfo.parentLayerID) || lyr.parentLayerInfo;
          if (parentLayerInfo) {
            if (parentLayerInfo.layerObject) {
              ll = parentLayerInfo.layerObject;
              type = ll.type;
              if (parentLayerInfo.originOperLayer && parentLayerInfo.originOperLayer.featureCollection) {
                var layers = parentLayerInfo.originOperLayer.featureCollection.layers;
                if (layers) {
                  for (var j = 0; j < layers.length; j++) {
                    var _lyr = layers[j];
                    if (_lyr.id === id) {
                      pl = _lyr;
                    }
                  }
                }
              }
            }
          }
          l = lyr.layerObject ? lyr.layerObject : lyr;
          type = lyrType;
          layerObject = (ll && !ll.empty) ? ll : l ? l : lyr;
          if (selfType === 'geo_rss' && layerObject && layerObject.getFeatureLayers) {
            var featureLayers = layerObject.getFeatureLayers();
            for (var i = 0; i < featureLayers.length; i++) {
              var fl = featureLayers[i];
              if (fl.id === lyrInfo.id) {
                layerObject = fl;
              }
            }
          }
          pl = pl ? pl : lyr;
        }
      }

      this.layerList[id] = {
        type: type,
        layerObject: layerObject,
        pl: pl,
        id: id,
        visible: jimuLayerInfo && jimuLayerInfo.isShowInMap ? jimuLayerInfo.isShowInMap() : true,
        li: lyrInfo,
        filter: jimuLayerInfo ? jimuLayerInfo.getFilter() : "1=1",
        infoTemplate: jimuLayerInfo.getInfoTemplate() || lyrInfo.infoTemplate,
        selfType: selfType,
        listDisabled: listDisabled,
        showAllFeatures: this.showAllFeatures
      };

      if (lyr.layerType !== "ArcGISStreamLayer") {
        this.updateRenderer(id);
      }

      if (!this.hidePanel) {
        this._addPanelItem(ll ? ll : l ? l : lyr, lyrInfo, listDisabled, jimuLayerInfo);
      }
    },

    _checkListDisabled: function (lyrInfo) {
      return lyrInfo.symbolData.featureDisplayOptions.listDisabled ?
        lyrInfo.symbolData.featureDisplayOptions.listDisabled : lyrInfo.symbolData.featureDisplayOptions.fields ?
          lyrInfo.symbolData.featureDisplayOptions.fields.length === 0 : true;
    },

    _checkSelfType: function (jimuLayerInfo, lyrInfo, lyrType, lyr) {
      var _lo = (lyrInfo.layerObject && !lyrInfo.layerObject.empty) ? lyrInfo.layerObject : lyr;
      var originOpLayer = _lo && _lo.originOperLayer ? _lo.originOperLayer : lyr;

      var selfType = (jimuLayerInfo.originOperLayer && jimuLayerInfo.originOperLayer.selfType) ?
        jimuLayerInfo.originOperLayer.selfType : (originOpLayer && originOpLayer.selfType) ?
          originOpLayer.selfType : '';

      selfType = (selfType && selfType !== '') ? selfType : (originOpLayer && originOpLayer.layerType &&
        originOpLayer.layerType === "CSV") ? "collection" : lyrType === "Feature Collection" ? "collection" : '';
      if (!selfType && lyrType && lyrType === "KML") {
        selfType = "kml";
      }
      return selfType;
    },

    updateRenderer: function (id) {
      var l = this.layerList[id];
      if (l.li.symbolData.symbolType !== 'LayerSymbol') {
        if (typeof (l.li.orgRenderer) === 'undefined') {
          if (l.layerObject.renderer) {
            l.li.orgRenderer = l.layerObject.renderer;
          } else {
            l.li.orgRenderer = l.li.renderer;
          }
        }
        var renderer = new SimpleRenderer(jsonUtils.fromJson(l.li.symbolData.symbol));
        l.li.newRenderer = renderer;
        if (l.layerObject.setRenderer) {
          l.layerObject.setRenderer(renderer);
        } else if (l.layerObject.setLayerDrawingOptions) {
          var optionsArray = [];
          var drawingOptions = new LayerDrawingOptions();
          drawingOptions.renderer = renderer;
          optionsArray[l.li.subLayerId] = drawingOptions;
          l.layerObject.setLayerDrawingOptions(optionsArray);
        } else {
          console.log("Error setting the new renderer...will use the default rendering of the layer");
        }

        if (typeof (l.layerObject.refresh) === 'function') {
          l.layerObject.refresh();
        }
      }
    },

    _onRecNodeMouseover: function (rec) {
      domClass.add(rec, this.isDartTheme ? "layer-row-mouseover-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "layer-row-mouseover-dashboard" : "layer-row-mouseover");
    },

    _onRecNodeMouseout: function (rec) {
      domClass.remove(rec, this.isDartTheme ? "layer-row-mouseover-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "layer-row-mouseover-dashboard" : "layer-row-mouseover");
    },

    _addPanelItem: function (layer, lyrInfo, listDisabled, jimuLayerInfo) {
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      var id = lyrInfo.id in this.layerList ? lyrInfo.id : potentialNewID in this.layerList ? potentialNewID : '';
      var lyr = this.layerList[id];
      if (lyr) {
        var lyrType = lyr.type;
        var cssAry;
        if (this.isDashboardTheme) {
          cssAry = ['rec', 'expand', 'expandDown-dashboard', 'solidBorder'];
        } else if (this.isDartTheme) {
          cssAry = ['rec-dart', 'expand-dart', 'expandDown-dart', 'solidBorder-dart'];
        } else {
          cssAry = ['rec', 'expand', 'expandDown', 'solidBorder'];
        }
        var rec = domConstruct.create("div", {
          'class': cssAry[0] + " " + cssAry[3],
          id: 'rec_' + id
        }, this.pageMain);

        var expandClass;
        if (!listDisabled) {
          this.own(on(rec, 'mouseover', lang.hitch(this, this._onRecNodeMouseover, rec)));
          this.own(on(rec,  'mouseout', lang.hitch(this, this._onRecNodeMouseout, rec)));
          expandClass = cssAry[1] + " " + cssAry[2];
          if (jimuLayerInfo && jimuLayerInfo.isInScale) {
            expandClass += jimuLayerInfo.isInScale() ? "" : " expandInActive";
          }
        } else {
          html.setStyle(rec, "cursor", "default");
          expandClass = 'expand-empty';
        }
        domConstruct.create("div", {
          'class': expandClass,
          id: "exp_" + id
        }, rec);

        var recIcon = domConstruct.create("div", {
          'class': "recIcon active",
          id: "recIcon_" + id
        }, rec);

        if (lyrInfo.panelImageData && lyrInfo.panelImageData.toString().indexOf('<img') > -1) {
          var img = document.createElement('div');
          img.innerHTML = lyrInfo.panelImageData;
          var icon = new PictureMarkerSymbol(img.children[0].src, 26, 26);
          lyrInfo.panelImageData = this._createImageDataDiv(icon, 44, 44, undefined, true).innerHTML;
        }
        recIcon.innerHTML = lyrInfo.panelImageData;
        domStyle.set(recIcon.firstChild, "border-radius", "41px");

        var recLabel;
        var recNum;
        if (this.config.countEnabled) {
          recLabel = domConstruct.create("div", {
            'class': "recLabel",
            id: "recLabel_" + id,
            innerHTML: "<p>" + lyrInfo.label + "</p>"
          }, rec);
          html.setStyle(recLabel, "top", "20px");
          recNum = domConstruct.create("div", {
            'class': "recNum",
            id: "recNum_" + id,
            innerHTML: ""
          }, rec);
        } else {
          recLabel = domConstruct.create("div", {
            'class': "recLabelNoCount",
            id: "recLabel_" + id,
            innerHTML: "<p>" + lyrInfo.label + "</p>"
          }, rec);
        }

        if (lyrType === "ClusterLayer") {
          layer.node = recNum;
          if (!listDisabled) {
            this._addLegend(id, lyr);
          }
          layer._updateNode(layer.nodeCount);
        } else if (lyrType === "StreamLayer") {
          lyr.node = recNum;
          this.countFeatures(lyr);
          if (!listDisabled) {
            this._addLegend(id, lyr);
          }
        } else {
          lyr.node = recNum;
          this._addLegend(id, lyr);
        }

        on(recIcon, "click", lang.hitch(this, this._toggleLayerVisibility, lyr));

        if (!listDisabled) {
          lyr.toggleLegend = on(rec, "click", lang.hitch(this, this._toggleLegend, lyr));
        }
      }
    },

    _addLegend: function (id, layerListLayer) {
      layerListLayer.legendOpen = this.row === null && this.config.expandList;
      var _class = layerListLayer.legendOpen ? "legendOn" : "legendOff";
      layerListLayer.legendNode = domConstruct.create("div", {
        "class": "legendLayer " + _class,
        "id": "legend_" + id
      }, this.pageMain);
      if (layerListLayer.type === 'ClusterLayer') {
        layerListLayer.layerObject.legendNode = layerListLayer.legendNode;
      }
      this.row = 'firstRowExpanded';
    },

    _getListFields: function (lyr) {
      var popupFields = [];
      var infoTemp = this._getInfoTemplate(lyr);

      var fieldInfos = (infoTemp && infoTemp.info && infoTemp.info.fieldInfos) ? infoTemp.info.fieldInfos : [];
      array.forEach(fieldInfos, function (fieldInfo) {
        if (fieldInfo.visible) {
          popupFields.push(fieldInfo.fieldName);
        }
      });

      var displayOptions = (lyr.li.symbolData && lyr.li.symbolData.featureDisplayOptions) ?
        lyr.li.symbolData.featureDisplayOptions : {};
      var fields = displayOptions.fields || [];
      array.forEach(fields, function (field) {
        if (popupFields.indexOf(field.name) === -1) {
          popupFields.push(field.name);
        }
      });
      if (displayOptions.groupField) {
        if (popupFields.indexOf(displayOptions.groupField.name) === -1) {
          popupFields.push(displayOptions.groupField.name);
        }
      }

      if (popupFields.length === 0 || typeof (infoTemp) === 'undefined') {
        popupFields = ['*'];
      }

      if (popupFields[0] !== '*') {
        if (lyr.layerObject && lyr.layerObject.objectIdField) {
          if (popupFields.indexOf(lyr.layerObject.objectIdField) === -1) {
            popupFields.push(lyr.layerObject.objectIdField);
          }
        }
      }
      return popupFields;
    },

    _loadList: function (lyr, updateCount) {
      if (!this.hidePanel) {
        var id = lyr.layerObject.id in this.layerList ? lyr.layerObject.id : lyr.li.id;
        if (updateCount) {
          this._addSearching(id);
        }

        var popupFields = this._getListFields(lyr);
        if (lyr.type === "ClusterLayer") {
          if (lyr.li.layerListExtentChanged) {
            lyr.layerObject.clusterFeatures();
            lyr.li.layerListExtentChanged = false;
          }
          var features = [];
          if (lyr.layerObject.clusterGraphics || lyr.layerObject._features) {
            if (this.showAllFeatures) {
              features = lyr.layerObject._features;
            } else {
              var clusterGraphics = lyr.layerObject.clusterGraphics;
              for (var z = 0; z < clusterGraphics.length; z++) {
                var clusterGraphic = clusterGraphics[z];
                if (clusterGraphic.graphics && clusterGraphic.graphics.length > 0) {
                  for (var f = 0; f < clusterGraphic.graphics.length; f++) {
                    var g = clusterGraphic.graphics[f];
                    features.push(g);
                  }
                }
              }
            }
            setTimeout(lang.hitch(this, function () {
              this._updateList(features, lyr.legendNode, lyr.layerObject.node, popupFields, updateCount, lyr);
            }), 100);
          } else {
            this._removeSearching(id, lyr.legendNode ? !domClass.contains(lyr.legendNode, 'legendOff') : true);
          }
        } else {
          this.getFeatures(lyr, popupFields, updateCount);
          return;
        }
      }
    },

    _addSearching: function (id) {
      var disabled = this.layerList[id].listDisabled;
      var eD = disabled ? 'expand-empty' : this.isDartTheme ? 'expandDown-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
      var eU = disabled ? 'expand-empty' : this.isDartTheme ? 'expandUp-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
      var eS = disabled ? "expandSearching-empty" : "expandSearching";
      if (domClass.contains("exp_" + id, eD)) {
        domClass.remove("exp_" + id, eD);
        domClass.add("exp_" + id, eS);
      }
      if (domClass.contains("exp_" + id, eU)) {
        domClass.remove("exp_" + id, eU);
        domClass.add("exp_" + id, eS);
      }
    },

    _removeSearching: function (id, legendOpen) {
      var disabled = this.layerList[id].listDisabled;
      var eD = disabled ? 'expand-empty' : this.isDartTheme ? 'expandDown-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
      var eU = disabled ? 'expand-empty' : this.isDartTheme ? 'expandUp-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
      var eS = disabled ? "expandSearching-empty" : "expandSearching";
      if (domClass.contains("exp_" + id, eS)) {
        domClass.remove("exp_" + id, eS);
        domClass.add("exp_" + id, legendOpen ? eU : eD);
      }
    },

    _getClusterLayer: function (lyrInfo, layer, jimuLayerInfo, lyrType) {
      var lyr = layer.layerObject ? layer.layerObject : layer;
      var infoTemplate = lyrInfo.infoTemplate;
      var originOperLayer = lyr && lyr.originOperLayer ? lyr.originOperLayer : layer.parentLayerInfo ?
        layer.parentLayerInfo : jimuLayerInfo ? jimuLayerInfo.originOperLayer : undefined;
      var clusterLayer = null;
      var n;
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      var configChange = true;
      if (this.map.graphicsLayerIds.indexOf(potentialNewID) > -1 || this.map._layers.indexOf(potentialNewID) > -1) {
        clusterLayer = this.map.getLayer(potentialNewID);

        var reloadData = false;
        var refreshData = false;

        //update the symbol if it has changed
        if (JSON.stringify(clusterLayer.symbolData) !== JSON.stringify(lyrInfo.symbolData)) {
          clusterLayer.symbolData = lyrInfo.symbolData;
          clusterLayer.countColor = lyrInfo.symbolData._highLightColor;
          refreshData = true;
        }

        //update the icon if it has changed
        n = domConstruct.toDom(lyrInfo.panelImageData);
        if (JSON.stringify(clusterLayer.icon) !== JSON.stringify(n.src)) {
          clusterLayer.icon = n.src;
          refreshData = true;
        }
        domConstruct.destroy(n.id);

        clusterLayer.displayFeatureCount = lyrInfo.symbolData.displayFeatureCount;

        if (clusterLayer.refresh !== lyrInfo.refresh) {
          clusterLayer.refresh = lyrInfo.refresh;
          reloadData = true;
        }

        if (refreshData) {
          clusterLayer._setupSymbols();
        }

        clusterLayer.countEnabled = this.config.countEnabled;
        clusterLayer.hidePanel = this.hidePanel;

        if (clusterLayer.showAllFeatures !== this.showAllFeatures) {
          reloadData = true;
          clusterLayer.showAllFeatures = this.showAllFeatures;
        }
        if (clusterLayer.listDisabled !== this.listDisabled) {
          reloadData = true;
          clusterLayer.listDisabled = this.listDisabled;
        }

        if (reloadData) {
          if (clusterLayer.url) {
            clusterLayer.refreshFeatures(clusterLayer.url);
          }
        } else if (refreshData) {
          clusterLayer.clusterFeatures();
        }
      } else {
        configChange = false;
        clusterLayer = new ClusterLayer({
          name: lyrInfo.label + this.UNIQUE_APPEND_VAL_CL,
          id: potentialNewID,
          map: this.map,
          node: dom.byId("recNum_" + potentialNewID),
          legendNode: dom.byId("legend_" + potentialNewID),
          infoTemplate: typeof (lyr.infoTemplate) !== 'undefined' ? lyr.infoTemplate : infoTemplate,
          refreshInterval: this.config.refreshInterval,
          refreshEnabled: this.config.refreshEnabled,
          parentLayer: lyr,
          lyrInfo: lyrInfo,
          lyrType: lyrType,
          _styleColor: this._styleColor,
          originOperLayer: originOperLayer,
          countEnabled: this.config.countEnabled,
          hidePanel: this.hidePanel,
          filter: jimuLayerInfo ? jimuLayerInfo.getFilter() : "1=1",
          showAllFeatures: this.showAllFeatures,
          listDisabled: this.listDisabled
        });
      }
      clusterLayer.setVisibility(configChange ? clusterLayer.visible :
        jimuLayerInfo.isShowInMap ? jimuLayerInfo.isShowInMap() : true);
      return clusterLayer;
    },

    _createImageDataDiv: function (sym, w, h, parent, isCustom) {
      var a;
      var symbol = sym;
      if (symbol) {
        //TODO are these switched??
        var height = w;
        var width = h;
        if (symbol.height && symbol.width) {
          var ar;
          if (symbol.height > symbol.width) {
            ar = symbol.width / symbol.height;
            width = w * ar;
          } else if (symbol.width === symbol.height || symbol.width > symbol.height) {
            width = w;
            ar = symbol.width / symbol.height;
            height = (ar > 0) ? h * ar : h;
          }
        }
        if (typeof (symbol.setWidth) !== 'undefined') {
          if (typeof (symbol.setHeight) !== 'undefined') {
            symbol.setWidth(isCustom ? width - (width * 0.25) : width);
            symbol.setHeight(isCustom ? height - (height * 0.25) : height);
          } else {
            symbol.setWidth(2);
          }
        } else if (typeof (symbol.size) !== 'undefined') {
          if (symbol.size > 20) {
            symbol.setSize(20);
          }
        }
        a = domConstruct.create("div", { 'class': "imageDataGFX" }, parent);
        var mySurface = gfx.createSurface(a, w, h);
        var descriptors = jsonUtils.getShapeDescriptors(symbol);
        var shape = mySurface.createShape(descriptors.defaultShape)
          .setFill(descriptors.fill)
          .setStroke(descriptors.stroke);
        shape.applyTransform({ dx: w / 2, dy: h / 2 });
      }
      return a;
    },

    _updateUI: function (styleName) {
      this.styleName = styleName;

      if (this.isDashboardTheme) {
        this.isLightTheme = styleName ? styleName === 'light' : this.isLightTheme;

        var removeDownClass = this.isLightTheme ? 'expandDown-dashboard' : 'expandDown';
        var addDownClass = this.isLightTheme ? 'expandDown' : 'expandDown-dashboard';
        this._updateNodes(removeDownClass, addDownClass);

        var removeUpClass = this.isLightTheme ? 'expandUp-dashboard' : 'expandUp';
        var addUpClass = this.isLightTheme ? 'expandUp' : 'expandUp-dashboard';
        this._updateNodes(removeUpClass, addUpClass);

        var removeExpandClass = this.isLightTheme ? 'expand-dashboard' : 'expand';
        var addExpandClass = this.isLightTheme ? 'expand' : 'expand-dashboard';
        this._updateNodes(removeExpandClass, addExpandClass);

        var removeGroupItemUpClass = this.isLightTheme ? 'groupItemImageUp-dashboard' : 'groupItemImageUp';
        var addGroupItemUpClass = this.isLightTheme ? 'groupItemImageUp' : 'groupItemImageUp-dashboard';
        this._updateNodes(removeGroupItemUpClass, addGroupItemUpClass);

        var removeGroupItemDownClass = this.isLightTheme ? 'groupItemImageDown-dashboard' : 'groupItemImageDown';
        var addGroupItemDownClass = this.isLightTheme ? 'groupItemImageDown' : 'groupItemImageDown-dashboard';
        this._updateNodes(removeGroupItemDownClass, addGroupItemDownClass);

        var removeGroupItemClass = this.isLightTheme ? 'groupItemImage-dashboard' : 'groupItemImage';
        var addGroupItemClass = this.isLightTheme ? 'groupItemImage' : 'groupItemImage-dashboard';
        this._updateNodes(removeGroupItemClass, addGroupItemClass);
      }
    },

    _updateNodes: function (remove, add) {
      var nodes = query('.' + remove);
      array.forEach(nodes, function (node) {
        domClass.remove(node, remove);
        domClass.add(node, add);
      });
    },

    _toggleLayerVisibility: function (obj, e) {
      e.stopPropagation();
      this.map.infoWindow.hide();
      var id = obj.id ? obj.id : obj.layerObject.id;
      var lyr = this.layerList[id];
      if (!lyr) {
        if (obj.pl) {
          id = obj.pl.id;
        }
        lyr = this.layerList[id];
      }

      if (lyr) {
        var hasSubLayerId = lyr.li && lyr.li.hasOwnProperty("subLayerId") ?
          (typeof (lyr.li.subLayerId) !== 'undefined' && lyr.li.subLayerId.toString() !== "-1") : false;

        var lyrInfo = this.operLayerInfos.getLayerInfoById(id);
        var _vis = !domClass.contains("recIcon_" + id, "active");

        if (hasSubLayerId && lyr.type !== 'ClusterLayer') {
          if (_vis) {
            var currentLayerInfo = lyrInfo.parentLayerInfo;
            while (currentLayerInfo) {
              currentLayerInfo.setTopLayerVisible(true);
              currentLayerInfo = currentLayerInfo.parentLayerInfo;
            }
          }

          lyrInfo.setTopLayerVisible(_vis);

        } else if (lyr) {
          lyr.layerObject.setVisibility(_vis);
          if (lyr.type === 'ClusterLayer' && _vis) {
            lyr.layerObject.handleMapExtentChange({ levelChange: true });
            lyr.layerObject.flashFeatures();
          }
          if (typeof (lyr.pl) !== 'undefined') {
            lyr.pl.visibility = _vis;
            if (this.map.graphicsLayerIds.indexOf(id) > -1) {
              var l = this.map.getLayer(id);
              l.setVisibility(_vis);
            }
          }
        }
        //this._toggleLayerUI(lyr.li, _vis);
      }
      //return false;
    },

    _toggleLayerUI: function (obj, vis) {
      var id = obj.id ? obj.id : obj.layerObject.id;
      var lyr = this.layerList[id];
      if (!lyr) {
        if (obj.pl) {
          id = obj.pl.id;
        }
        lyr = this.layerList[id];
      }
      if (lyr) {
        var lyrInfo = this.operLayerInfos.getLayerInfoById(id);
        var visScalRange = lyrInfo.isCurrentScaleInTheScaleRange ? lyrInfo.isCurrentScaleInTheScaleRange() : true;

        var c = dom.byId("recLabel_" + id);

        this.layerList[id].visible = vis;
        this.layerList[id].parentLayerVisible = vis;
        if (this.layerList[id].type === 'ClusterLayer') {
          this.layerList[id].layerObject.parentLayerVisible = vis;
        }
        if (this.config.countEnabled) {
          if (domClass.contains("recNum_" + id, !vis ? "recNum" : "recNumInActive")) {
            var _append = this.isDartTheme ? ' darkThemeColor' : ' lightThemeColor';
            domClass.remove("recNum_" + id, !vis ? "recNum" : "recNumInActive");
            domClass.add("recNum_" + id, (!vis ? "recNumInActive" : "recNum") + _append);
          }
        }

        var eD = this.isDartTheme ? 'expandDown-dart' :
          (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
        var eU = this.isDartTheme ? 'expandUp-dart' :
          (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';

        if (!vis) {
          domClass.remove("recIcon_" + id, "active");
          //this._clearList(this.layerList[id]);
          if (c && c.firstChild) {
            domClass.add(c.firstChild, "inActive");
          }
          if (!domClass.contains("exp_" + id, "expandInActive")) {
            domClass.add("exp_" + id, "expandInActive");
          }
          if (lyr.legendOpen) {
            if (domClass.contains("legend_" + id, "legendOn")) {
              //this.layerList[id].legendOpen = false;
              domClass.remove("legend_" + id, "legendOn");
              domClass.add("legend_" + id, "legendOff");
              if (domClass.contains("exp_" + id, eU)) {
                domClass.remove("exp_" + id, eU);
                domClass.add("exp_" + id, eD);
              }
            }
          }
          if (lyr.toggleLegend) {
            lyr.toggleLegend.remove();
          }
          if (domClass.contains("rec_" + id, "rec")) {
            domClass.add("rec_" + id, "recDefault");
          }
        } else {
          domClass.add("recIcon_" + id, "active");
          if (c && c.firstChild) {
            domClass.remove(c.firstChild, "inActive");
          }
          if (domClass.contains("exp_" + id, "expandInActive") && visScalRange) {
            domClass.remove("exp_" + id, "expandInActive");
          }
          if (lyr.toggleLegend) {
            lyr.toggleLegend.remove();
          }
          var rec = dom.byId('rec_' + id);
          if (rec) {
            lyr.toggleLegend = on(rec, "click", lang.hitch(this, this._toggleLegend, lyr));
          }

          if (domClass.contains("rec_" + id, "recDefault")) {
            domClass.remove("rec_" + id, "recDefault");
          }

          if (!lyr.listDisabled) {
            this._loadList(lyr, true);
            if (lyr.legendOpen) {
              domClass.add("legend_" + id, "legendOn");
              domClass.remove("legend_" + id, "legendOff");
              if (domClass.contains("exp_" + id, eD)) {
                domClass.remove("exp_" + id, eD);
                domClass.add("exp_" + id, eU);
              }
            }
          }
        }
      }
      return false;
    },

    _toggleLegend: function (obj, evt) {
      if (evt.currentTarget.className !== 'thumb2' && evt.currentTarget.className !== 'recIcon') {
        var id = obj.layerObject.id in this.layerList ? obj.layerObject.id : obj.li.id;
        if (domClass.contains("legend_" + id, "legendOff")) {
          this._addSearching(id);
          this.layerList[id].legendOpen = true;
          if (typeof (this.layerList[id].li.layerListExtentChanged) === 'undefined' ||
            this.layerList[id].requiresReload) {
            this.layerList[id].li.layerListExtentChanged = true;
            this.layerList[id].requiresReload = false;
          }
          if (this.layerList[id].li.layerListExtentChanged) {
            setTimeout(lang.hitch(this, function () {
              this._loadList(obj, false);
            }), 500);
          } else {
            this._removeSearching(id, true);
          }
          domClass.remove("legend_" + id, "legendOff");
          domClass.add("legend_" + id, "legendOn");
        } else {
          if (domClass.contains("legend_" + id, "legendOn")) {
            this.layerList[id].legendOpen = false;
            var eD = this.isDartTheme ? 'expandDown-dart' :
              (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
            var eU = this.isDartTheme ? 'expandUp-dart' :
              (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
            if (domClass.contains("exp_" + id, eU)) {
              domClass.remove("exp_" + id, eU);
              domClass.add("exp_" + id, eD);
            }
            domClass.remove("legend_" + id, "legendOn");
            domClass.add("legend_" + id, "legendOff");
          }
        }
      }
      evt.stopPropagation();
    },

    _toggleGroup: function (obj, e) {
      var id = e.currentTarget.id.slice(0, -2);
      var fI = this.isDartTheme ? 'featureItem-dart' : 'featureItem';

      var toggle = true;
      if (e.target.parentNode) {
        if (e.target.parentNode.id !== "") {
          if (domClass.contains(e.target.parentNode.id, fI)) {
            toggle = false;
          }
        }
        if (e.target.id !== "") {
          if (domClass.contains(e.target.id, fI)) {
            toggle = false;
          }
        }
      }

      var gII = this.isDartTheme ? "groupItemImage-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImage-dashboard" : "groupItemImage";
      var gIIUp = this.isDartTheme ? "groupItemImageUp-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImageUp-dashboard" : "groupItemImageUp";
      var gIIDown = this.isDartTheme ? "groupItemImageDown-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImageDown-dashboard" : "groupItemImageDown";
      if (toggle) {
        var lId = obj.layerObject.id in this.layerList ? obj.layerObject.id : obj.li.id;
        var node = document.getElementById(e.currentTarget.id);
        var _idx = node.childNodes[0].childNodes.length - 1;
        if (domClass.contains(id, "groupOff")) {
          if (this.layerList[lId].openGroups && this.layerList[lId].openGroups.length > 0) {
            if (this.layerList[lId].openGroups.indexOf(id) === -1) {
              this.layerList[lId].openGroups.push(id);
            }
          } else {
            this.layerList[lId].openGroups = [id];
          }
          domClass.remove(id, "groupOff");
          domClass.add(id, "groupOn");
          this.layerList[lId].groupOpen = true;
          if (node.childNodes[0].childNodes[_idx].childNodes[0].className.indexOf(gII) > -1) {
            html.removeClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIDown);
            html.addClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIUp);
          }
        } else {
          if (domClass.contains(id, "groupOn")) {
            domClass.remove(id, "groupOn");
            domClass.add(id, "groupOff");

            if (this.layerList[lId].openGroups && this.layerList[lId].openGroups.length > 0) {
              var idx = this.layerList[lId].openGroups.indexOf(id);
              if (idx > -1) {
                this.layerList[lId].openGroups.splice(idx, 1);
              }
              if(this.layerList[lId].openGroups.length === 0){
                this.layerList[lId].groupOpen = false;
              }
            } else {
              this.layerList[lId].groupOpen = false;
            }
            if (node.childNodes[0].childNodes[_idx].childNodes[0].className.indexOf(gII) > -1) {
              html.removeClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIUp);
              html.addClass(e.currentTarget.childNodes[0].childNodes[_idx].childNodes[0], gIIDown);
            }
          }
        }
      }
    },

    /*jshint unused:false*/
    onAppConfigChanged: function (appConfig, reason, changedData) {
      switch (reason) {
        case 'themeChange':
          this.inPanelOverrides(changedData);
          this.destroy();
          break;
        case 'layoutChange':
          this.inPanelOverrides(changedData);
          //this.destroy();
          break;
        case 'styleChange':
          if (!this.hidePanel) {
            this._updateUI(changedData);
            this._updateStyleColor(changedData);
          }
          break;
        case 'widgetChange':
          this.widgetChange = true;
          if (changedData && changedData.config && changedData.config.layerInfos) {
            this.removeOldClusterLayers(changedData.config.layerInfos);
          }
          //TODO make sure of what if anything I need to do here if any of the new options are changed
          // does initWidget run after this?
          this.row = null;
          break;
        case 'mapChange':
          this._clearMap();
      }
    },

    _updateStyleColor: function (changedData) {
      setTimeout(lang.hitch(this, function () {
        var p = this.getPanel();
        var node;
        switch (this.appConfig.theme.name) {
          case 'BoxTheme':
            node = p.containerNode.parentNode.parentNode.children[0];
            break;
          case 'DartTheme':
            node = p.containerNode.parentNode;
            break;
          case 'TabTheme':
            node = p.containerNode;
            break;
          case 'BillboardTheme':
            node = p.containerNode.parentNode;
            break;
          case 'FoldableTheme':
            node = p.containerNode.parentNode.firstChild;
            break;
          default:
            node = this.pageHeader;
            break;
        }
        var bc = window.getComputedStyle(node, null).getPropertyValue('background-color');
        this._styleColor = Color.fromRgb(bc).toHex();
        for (var k in this.layerList) {
          var l = this.layerList[k];
          if (l.type === "ClusterLayer") {
            l.layerObject.setStyleColor(this._styleColor);
          }
        }
        this._updateUI(changedData);
      }), 50);
    },

    _clearMap: function () {
      if (this.layerList) {
        for (var k in this.layerList) {
          var l = this.layerList[k];
          if (l.type === "ClusterLayer") {
            var _clear = true;
            if (typeof (this.continuousRefreshEnabled) !== 'undefined') {
              _clear = !this.continuousRefreshEnabled;
            }
            if (_clear) {
              l.layerObject._clear();
              this.map.removeLayer(l.layerObject);
            }
          }
        }
        this.layerList = {};
      }
    },

    _close: function () {
      this.widgetManager.closeWidget(this.id);
    },

    onClose: function () {
      this.inherited(arguments);

      for (var key in this.layerList) {
        var layerListLayer = this.layerList[key];
        if (layerListLayer.li && layerListLayer.li.orgRenderer) {
          if (layerListLayer.layerObject.setRenderer) {
            layerListLayer.layerObject.setRenderer(layerListLayer.li.orgRenderer);
          } else if (layerListLayer.layerObject.setLayerDrawingOptions) {
            layerListLayer.layerObject.setLayerDrawingOptions([]);
          } else {
            console.log("Error re-setting the renderer");
          }
          layerListLayer.layerObject.refresh();
        }
      }

      var disableRefresh = true;
      if (typeof (this.config.continuousRefreshEnabled) !== 'undefined') {
        disableRefresh = !this.config.continuousRefreshEnabled;
      }
      if (disableRefresh) {
        if (this.refreshInterval !== 0) {
          this.refreshIntervalValue = 0;
          clearInterval(this.refreshInterval);
          this.refreshInterval = 0;
        }
      }

      if (!this.hidePanel) {
        if (typeof (this.mapExtentChangedHandler) !== 'undefined') {
          this.mapExtentChangedHandler.remove();
          this.mapExtentChangedHandler = undefined;
        } else {
          if (typeof (this.iconClickHandler) !== 'undefined') {
            this.iconClickHandler.remove();
            this.iconClickHandler = undefined;
          }
        }
      }
    },

    _clearChildNodes: function (parentNode) {
      while (parentNode.hasChildNodes()) {
        parentNode.removeChild(parentNode.lastChild);
      }
    },

    _inVisibleRange: function (lyr, id) {
      var visScaleRange = true;
      if (lyr.layerObject && lyr.layerObject.hasOwnProperty('visibleAtMapScale')) {
        visScaleRange = lyr.layerObject.visibleAtMapScale;
      }
      var lyrInfo = this.operLayerInfos.getLayerInfoById(id);
      if (lyrInfo && lyrInfo.isCurrentScaleInTheScaleRange) {
        visScaleRange = lyrInfo.isCurrentScaleInTheScaleRange();
      }
      return visScaleRange;
    },

    _mapExtentChange: function () {
      var countEnabled = this.config.countEnabled;
      var queries = [];
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        var visScaleRange = this._inVisibleRange(lyr, key);
        if (!this.showAllFeatures) {
          this._clearList(lyr);
        }
        if (!lyr.legendOpen || (lyr.groupEnabled && !lyr.groupOpen)) {
          if (lyr.li) {
            lyr.li.layerListExtentChanged = true;
          }
          if (lyr.visible && visScaleRange) {
            if (lyr.type === "ClusterLayer" && lyr.layerObject.initalLoad && this.config.countEnabled) {
              lyr.layerObject._updateNode(lyr.layerObject.node.innerHTML);
            }

            if (lyr.type !== 'ClusterLayer') {
              var uNode = this.config.countEnabled ? lyr.node : lyr.legendNode;
              if (typeof (lyr.layerObject) === 'undefined') {
                console.log("layer object not known");
              } else {
                this.countFeatures(lyr);
              }
            }
          } else if (!visScaleRange) {
            this._updateList([], lyr.legendNode, lyr.node, [], true, lyr);
          }
        } else {
          if (lyr.visible && visScaleRange) {
            lyr.updateList = true;
            this._loadList(lyr, lyr.updateList);
          } else {
            this._updateList([], lyr.legendNode, lyr.node, [], true, lyr);
          }
        }
      }
    },

    getFeatures: function (lyrInfo, fields, updateCount) {
      var lyr = lyrInfo.layerObject;
      var legendNode = lyrInfo.legendNode;
      var node = lyrInfo.node;
      var _needsGeom = !lyrInfo.listDisabled && lyrInfo.legendOpen ? true : false;
      var visScaleRange = this._inVisibleRange(lyr, lyrInfo.id || lyrInfo.li.id);
      var maxRecordCount = (lyr && lyr.maxRecordCount) ? lyr.maxRecordCount : undefined;
      var url;
      var queries = [];
      var q = this._getQuery(lyrInfo, fields, _needsGeom);
      if (lyrInfo.visible && visScaleRange) {
        if (lyr.queryFeatures) {
          //get the first set of features
          if (!lyrInfo.listDisabled) {
            queries.push(lyr.queryFeatures(q));
          }
          //query the ids incase we need more than maxRecordCount
          queries.push(lyr.queryIds(q));
        } else {
          url = lyrInfo.li.url;
          if (url.indexOf("MapServer") > -1 || url.indexOf("FeatureServer") > -1) {
            var qt = new QueryTask(url);
            //get the first set of features
            if (!lyrInfo.listDisabled) {
              queries.push(qt.execute(q));
            }
            //query the ids incase we need more than maxRecordCount
            queries.push(qt.executeForIds(q));
          }
        }
      } else {
        //if it's not visible and not within the visible scale range
        this._updateList([], lyrInfo.legendNode, lyrInfo.node, [], true, lyrInfo);
      }
      if (queries.length > 0) {
        var featurePromises = all(queries);
        featurePromises.then(lang.hitch(this, function (results) {
          var s_id = lyrInfo.layerObject.id in this.layerList ? lyrInfo.layerObject.id : lyrInfo.li.id;
          var updateNode;
          if (node) {
            updateNode = this.config.countEnabled ? node.parentNode : node.previousSibling;
          }
          if (results && results.length > 1) {
            var _queries = [];
            var queryIDs = results[1];
            var count = 0;
            //if IDs exceed max count we need to chunk
            if (queryIDs && maxRecordCount && queryIDs.length > maxRecordCount) {
              this._chunkRequest(lyr, url, queryIDs, maxRecordCount, fields, _needsGeom).then(lang.hitch(this,
                function (fullFeatures) {
                this._updateList(fullFeatures, legendNode, node, fields, updateCount, lyrInfo);
              }));
            } else {
              this._updateList(results[0].features, legendNode, node, fields, updateCount, lyrInfo);
            }
          } else if (results && results.length === 1) {
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(results[0].length);
            }
            this._removeSearching(s_id, false);
          } else {
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(0);
            }
            this.updateExpand(updateNode, true);
            this._removeSearching(s_id, lyrInfo.legendOpen);
          }
        }));
      }
    },

    _chunkRequest: function (lyr, url, IDs, max, fields, needsGeom) {
      var def = new Deferred();
      var queries = [];
      var i, j;
      for (i = 0, j = IDs.length; i < j; i += max) {
        var ids = IDs.slice(i, i + max);

        var q = new Query();
        q.outFields = fields;
        q.objectIds = ids;
        q.returnGeometry = needsGeom;

        if (lyr.queryFeatures) {
          queries.push(lyr.queryFeatures(q));
        } else if (url) {
          var qt = new QueryTask(url);
          queries.push(qt.execute(q));
        }
      }
      var queryList = new DeferredList(queries);
      queryList.then(lang.hitch(this, function (queryResults) {
        if (queryResults) {
          var allFeatures = [];
          for (var i = 0; i < queryResults.length; i++) {
            if (queryResults[i][1].features) {
              allFeatures.push.apply(allFeatures, queryResults[i][1].features);
            }
          }
          def.resolve(allFeatures);
        }
      }));
      return def;
    },

    _clearList: function (lyrInfo) {
      if (!lyrInfo.isLoaded && lyrInfo.legendNode) {
        lyrInfo.isLoaded = false;
        lyrInfo.legendNode.innerHTML = '';
      }
    },

    _updateList: function (features, legendNode, node, fields, updateCount, lyrInfo, countOnly) {
      var li = lyrInfo.li ? lyrInfo.li : lyrInfo;

      if (lyrInfo.type === 'ClusterLayer') {
        if (lyrInfo.layerObject.node) {
          if (domClass.contains(lyrInfo.layerObject.node.id, 'searching')) {
            domClass.remove(lyrInfo.layerObject.node.id, 'searching');
          }
        }
      }


      var infoTemplate = lyrInfo.infoTemplate;
      var displayOptions = lyrInfo.symbolData ? lyrInfo.symbolData.featureDisplayOptions : (li && li.symbolData) ?
        li.symbolData.featureDisplayOptions : {};

      if (node || legendNode) {
        if (legendNode && (lyrInfo.hasOwnProperty('isLoaded') ? !lyrInfo.isLoaded : true)) {
          legendNode.innerHTML = '';
        }
        if (updateCount && node && this.config.countEnabled) {
          node.innerHTML = utils.localizeNumber(features.length);
        }
        var updateNode = this.config.countEnabled ? node.parentNode : legendNode.previousSibling;
        if ((lyrInfo.type === 'ClusterLayer' && lyrInfo.visible) || lyrInfo.type !== 'ClusterLayer') {
          this.updateExpand(updateNode, features.length === 0);
        }
      }
      if (countOnly) {
        return;
      }

      if (!lyrInfo.listDisabled && !lyrInfo.isLoaded) {
        if (features.length > 0) {
          var jimuLayerInfo = this.operLayerInfos.getLayerInfoById(lyrInfo.id);

          var renderer = (lyrInfo.type === "ClusterLayer") ? lyrInfo.layerObject.renderer :
            (jimuLayerInfo && jimuLayerInfo.layerObject && jimuLayerInfo.layerObject.renderer) ?
              jimuLayerInfo.layerObject.renderer :
              features[0]._graphicsLayer ? features[0]._graphicsLayer.renderer :
                (lyrInfo.layerObject && lyrInfo.layerObject.renderer) ? lyrInfo.layerObject.renderer :
                  (li && li.renderer) ? jsonUtil.fromJson(li.renderer) || li.renderer :
                    lyrInfo.renderer ? jsonUtil.fromJson(lyrInfo.renderer) || lyrInfo.renderer : undefined;

          var groupNodes = [];
          var finalGroupNodes = [];
          var finalDomNodes = [];
          for (var i = 0; i < features.length; i++) {
            var groupAdded = false;
            var feature = features[i];
            if (typeof (feature.infoTemplate) === 'undefined' && infoTemplate) {
              feature.infoTemplate = infoTemplate;
            }

            var symbol = (renderer && renderer.getSymbol) ? renderer.getSymbol(feature) :
              (feature.symbol) ? jsonUtils.fromJson(feature.symbol) : undefined;

            var oidName = (feature._layer && feature._layer.objectIdField) ? feature._layer.objectIdField :
              (li && li.oidFieldName && li.oidFieldName.name) ? li.oidFieldName.name :
                (lyrInfo.layerObject && lyrInfo.layerObject.objectIdField) ? lyrInfo.layerObject.objectIdField :
                  (lyrInfo && lyrInfo.oidFieldName) ? lyrInfo.oidFieldName : undefined;

            var id = oidName ? feature.attributes[oidName] : legendNode.id + i;

            var flds = (fields[0] === '*') ? feature.attributes : fields;
            var isNames = (fields[0] === '*') ? false : true;

            var displayStringObj = this.getDisplayString(feature, lyrInfo, flds, displayOptions, oidName, isNames);
            var displayString = displayStringObj.displayString;
            var aliasNames = displayStringObj.aliasNames;
            var firstValue = displayStringObj.firstValue;
            var groupField, groupNode, groupContainer, displayValue, groupType;
            if (displayOptions.groupEnabled) {
              var featureValue;
              var _value;
              var appendVal = undefined; // jshint ignore:line
              if (typeof (displayOptions.groupByField) === 'undefined' || displayOptions.groupByField) {
                groupField = displayOptions.groupField;
                featureValue = feature.attributes[groupField.name];
                groupType = 'byField';
                appendVal = featureValue;
              } else {
                groupField = displayOptions.groupByRendererOptions.fields[0];
                featureValue = feature.attributes[groupField.name];
                var groubByFields = displayOptions.groupByRendererOptions.fields;
                var groupByValues = displayOptions.groupByRendererOptions.values;
                groupType = 'byRenderer';

                if (featureValue !== null && featureValue !== "") {
                  expression_loop:
                  for (var ii = 0; ii < groupByValues.length; ii++) {
                    var _val = groupByValues[ii];
                    var exp = _val.value;
                    var expParts = exp.split("&&");
                    if (expParts && expParts.length > 1) {
                      exp = featureValue + expParts[0] + "&& " + featureValue + expParts[1];
                    } else {
                      exp = isNaN(featureValue) ? "'" + featureValue + "'" + _val.value : featureValue + _val.value;
                    }
                    if (eval(exp)) { // jshint ignore:line
                      _value = _val;
                      break expression_loop;
                    }
                  }
                  if (typeof (_value) !== 'undefined' && _value !== null) {
                    appendVal = _value.label.replace(/ /g, '');
                  }
                }
              }
              var gId = 'group_' + li.id + "_" + groupField.name + "_" + appendVal;
              var addGroup = true;
              var n;
              if (groupNodes.length > 0) {
                node_loop:
                for (var iii = 0; iii < groupNodes.length; iii++) {
                  var gNode = groupNodes[iii];
                  if (gId === gNode.id) {
                    if (groupType === 'byField' && featureValue === gNode.value || groupType === 'byRenderer') {
                      addGroup = false;
                      n = gNode.node;
                      groupContainer = gNode.parent;
                      break node_loop;
                    }
                  }
                }
              }
              if (addGroup) {
                groupAdded = true;
                groupContainer = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupItem-dart' : 'groupItem',
                  id: gId + "_c"
                });
                var groupTitle = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupItemTitle-dart' : 'groupItemTitle',
                  id: gId + "_t"
                }, groupContainer);
                var label = "";
                var title = groupType === 'byRenderer' ? "" : groupField.name + ": ";
                if (typeof (aliasNames) !== 'undefined') {
                  if (aliasNames.hasOwnProperty(groupField.name) && aliasNames[groupField.name] !== '') {
                    if (groupType === 'byField') {
                      title = aliasNames[groupField.name] + ": ";
                    } else {
                      title = "";
                    }
                  }
                }
                if (groupType === 'byField') {
                  if (typeof (groupField.label) !== 'undefined' && groupField.label !== "") {
                    label = groupField.label + ": ";
                    title = label;
                  }
                  if (label === ": ") {
                    label = "";
                    title = "";
                  }
                } else {
                  if (typeof (_value) !== 'undefined') {
                    if (typeof (_value.label) !== 'undefined' && _value.label !== "") {
                      label = title + _value.label;
                      title = label;
                    }
                  } else {
                    label = title + featureValue;
                    title = label;
                  }
                  if (label === ": ") {
                    label = "";
                    title = "";
                  }
                }
                displayValue = featureValue;
                if (this._checkDateField(lyrInfo, groupField.name)) {
                  displayValue = this.formatDateValue(featureValue, groupField.name, lyrInfo);
                }
                var domainField = this._checkDomainField(lyrInfo, groupField.name);
                if (domainField) {
                  displayValue = this.formatDomainValue(featureValue, domainField);
                }

                if (groupType === 'byRenderer' && symbol) {
                  this._createImageDataDiv(lang.clone(symbol), 30, 30, groupTitle, isCustom);
                }

                domConstruct.create('div', {
                  'class': groupType === 'byField' ? 'groupField' : 'groupFieldImage',
                  innerHTML: groupType === 'byField' ? label + displayValue : label,
                  title: groupType === 'byField' ? title + displayValue : title
                }, groupTitle);

                var inGrpList = false;
                if (lyrInfo.openGroups && lyrInfo.openGroups.length > 0) {
                  inGrpList = lyrInfo.openGroups.indexOf(gId) > -1;
                }
                var _append = this.isDartTheme ? ' darkThemeColor' : ' lightThemeColor';
                var groupCountNode = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupCountLabel' : 'groupCountLabel' + _append
                }, groupTitle);

                var imageContainer = domConstruct.create('div', {
                  'class': (this.isDartTheme || (this.isDashboardTheme && !this.isLightTheme)) ?
                    'expandImageContainer-dart' : 'expandImageContainer'
                }, groupTitle);

                var gIIUp = this.isDartTheme ? "groupItemImageUp-dart" :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImageUp-dashboard" : "groupItemImageUp";
                var gIIDown = this.isDartTheme ? "groupItemImageDown-dart" :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImageDown-dashboard" : "groupItemImageDown";
                var cNames = this.isDartTheme ? 'groupItemImage-dart' :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImage-dashboard" : 'groupItemImage';
                cNames += inGrpList ? ' ' + gIIUp : ' ' + gIIDown;
                domConstruct.create('div', {
                  'class': cNames
                }, imageContainer);

                cNames = this.isDartTheme ? 'groupItem-dart' : 'groupItem';
                cNames += (lyrInfo.groupOpen && inGrpList) ? ' groupOn' : ' groupOff';
                groupNode = domConstruct.create('div', {
                  'class': cNames,
                  id: gId
                }, groupContainer);

                groupNodes.push({
                  id: 'group_' + li.id + "_" + groupField.name + "_" + appendVal,
                  node: groupNode,
                  parent: groupContainer,
                  value: featureValue
                });

                finalGroupNodes.push({
                  value: featureValue,
                  node: groupContainer,
                  countNode: groupCountNode,
                  count: 1
                });

                on(groupContainer, "click", lang.hitch(this, this._toggleGroup, lyrInfo));
              } else {
                var result = finalGroupNodes.filter(function (o) {
                  if (o.node.id === (n.id + "_c")) {
                    return o;
                  }
                });

                result[0].count += 1;
                groupNode = n;
              }
            }
            var featureItem = domConstruct.create('div', {
              'class': this.isDartTheme ? 'featureItem-dart' : 'featureItem',
              id: 'feature_' + li.id + "_" + id
            });

            var isCustom = false;
            if (li && li.symbolData) {
              isCustom = li.symbolData.symbolType === "CustomSymbol";
            }
            if (symbol) {
              if (displayOptions.groupEnabled && groupType === 'byRenderer') {
                //this._createImageDataDiv(lang.clone(symbol), 30, 30, groupTitle, isCustom);
              } else {
                this._createImageDataDiv(lang.clone(symbol), 30, 30, featureItem, isCustom);
              }
            }

            on(featureItem, "click", lang.hitch(this, this._panToFeature, feature));

            if (displayString.indexOf(" - ") > -1) {
              displayString = displayString.slice(0, -3);
            }
            var _margin = displayOptions.groupEnabled && groupType === 'byRenderer' ? "15px" : "50px";
            var _txtAlign = window.isRTL ? "right" : "left";
            domConstruct.create('div', {
              style: "padding: 7px 5px 5px " + _margin + "; text-align: " + _txtAlign + ";",
              innerHTML: displayString,
              title: displayString
            }, featureItem);

            finalDomNodes.push({
              node: featureItem,
              updateNode: groupNode ? groupNode : legendNode,
              firstValue: firstValue
            });
          }

          if (finalGroupNodes.length > 0) {
            //sort and place at legendNode
            var nodes = finalGroupNodes.sort(function (a, b) {
              if (typeof (a.value) === 'undefined') {
                return b.value;
              } else if (typeof (b.value) === 'undefined') {
                return a.value;
              }
              if (isNaN(a.value)) {
                return a.value.localeCompare(b.value);
              } else {
                return parseFloat(a.value) - parseFloat(b.value);
              }
            });
            var cE = this.config.countEnabled;
            array.forEach(nodes, function (n) {
              if (cE) {
                n.countNode.innerHTML = utils.localizeNumber(n.count);
              }
              legendNode.appendChild(n.node);
            });
          }

          if (finalDomNodes.length > 0) {
            var sortedNodes = finalDomNodes.sort(function (a, b) {
              var _a = a.firstValue;
              var _b = b.firstValue;
              if (typeof (_a) === 'undefined' || _a === null || _a === "") {
                return 1;
              } else if (typeof (_b) === 'undefined' || _b === null || _b === "") {
                return -1;
              } else if (_a === _b) {
                return 0;
              }
              return _a.toString().localeCompare(_b.toString());
            });
            array.forEach(sortedNodes, function (fdn) {
              domConstruct.place(fdn.node, fdn.updateNode);
            });
          }
        }
      }
      li.layerListExtentChanged = false;

      var s_id = (lyrInfo.layerObject && lyrInfo.layerObject.id && lyrInfo.layerObject.id in this.layerList) ?
        lyrInfo.layerObject.id : li.id;
      if (this.showAllFeatures && lyrInfo.visible) {
        var loaded = true;
        if (lyrInfo.layerObject && lyrInfo.type === 'ClusterLayer') {
          loaded = !lyrInfo.layerObject.queryPending;
          if (lyrInfo.layerObject.hasOwnProperty('requiresReload')) {
            loaded = loaded && !lyrInfo.layerObject.requiresReload;
            lyrInfo.layerObject.requiresReload = false;
          }
        }
        lyrInfo.isLoaded = loaded;
      }

      this._removeSearching(s_id, lyrInfo.legendOpen);
    },

    updateDomainValues: function (feature, isNames, fields, lyrInfo) {
      var includeField, dateField, domainField, append, featureValue, fieldName;
      var displayString = "";
      for (var a in fields) {
        fieldName = isNames ? fields[a] : a;
        domainField = this._checkDomainField(lyrInfo, fieldName);
        featureValue = feature.attributes[fieldName];
        if (domainField) {
          feature.attributes[fieldName] = this.formatDomainValue(featureValue, domainField);
        }
      }
      return feature;
    },

    updateExpand: function (node, hide) {
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
            if (!domClass.contains(en, 'expand-empty')) {
              html.addClass(en, "expandInActive");
            }
          }
        } else {
          if (node) {
            html.removeClass(node, "recDefault");
            html.removeClass(node, "inActive");
          }
          if (en) {
            if (!domClass.contains(en, 'expand-empty')) {
              html.removeClass(en, "expandInActive");
            }
          }
        }
      }
    },

    getDisplayString: function (feature, lyrInfo, fields, displayOptions, oidName, isNames) {
      var displayString = "";
      var aliasNames = {};
      var firstValue = "";
      if (displayOptions.fields.length > 0) {
        array.forEach(displayOptions.fields, lang.hitch(this, function (displayField) {
          for (var a in fields) {
            var fieldName = isNames ? fields[a] : a;
            if (fieldName === displayField.name) {
              var aliasName = this._checkAliasName(lyrInfo, fieldName);
              var append = "";
              var label = "";
              if (typeof(displayField.label) !== 'undefined') {
                label = displayField.label;
                append = displayField.label.trim() === "" ? "" : ": ";
              }
              var featureValue = feature.attributes[fieldName];
              if (this._checkDateField(lyrInfo, fieldName)) {
                featureValue = this.formatDateValue(featureValue, fieldName, lyrInfo);
              }
              var domainField = this._checkDomainField(lyrInfo, fieldName);
              if (domainField) {
                featureValue = this.formatDomainValue(featureValue, domainField);
              }
              aliasNames[fieldName] = aliasName;
              if (aliasName) {
                fieldName = aliasName;
              }
              if (firstValue === "") {
                firstValue = featureValue;
              }
              displayString += label + append + featureValue + " - ";
              break;
            }
          }
        }));
      }
      return {
        displayString: displayString,
        aliasNames: aliasNames,
        firstValue: firstValue
      };
    },

    _getInfoTemplate: function (lyrInfo) {
      var infoTemplate = lyrInfo.infoTemplate;
      if (!infoTemplate) {
        if (lyrInfo.layerObject && lyrInfo.layerObject.infoTemplate) {
          infoTemplate = lyrInfo.layerObject.infoTemplate;
        } else if (lyrInfo.li && lyrInfo.li.infoTemplate) {
          infoTemplate = lyrInfo.li.infoTemplate;
        }
      }
      if (!infoTemplate) {
        if (typeof (lyrInfo.li.subLayerId) !== 'undefined') {
          var infoTemplates = lyrInfo.layerObject.infoTemplates;
          if (infoTemplates && infoTemplates.hasOwnProperty(lyrInfo.li.subLayerId)) {
            infoTemplate = infoTemplates[lyrInfo.li.subLayerId].infoTemplate;
          }
        }
      }
      return infoTemplate;
    },

    formatDomainValue: function (v, domain) {
      if (domain && domain.codedValues) {
        var cvs = domain.codedValues;
        for (var i = 0; i < cvs.length; i++) {
          var cv = cvs[i];
          if (cv.code === v) {
            return cv.name;
          }
        }
      }
      return undefined;
    },

    formatDateValue: function (v, fieldName, lyrInfo) {
      if (v) {
        var options;
        var infoTemplate = this._getInfoTemplate(lyrInfo);
        if (infoTemplate) {
          var fieldsMap = infoTemplate._fieldsMap;
          if (fieldsMap) {
            for (var k in fieldsMap) {
              if (fieldsMap[k].fieldName === fieldName) {
                options = fieldsMap[k].format;
                break;
              }
            }
          }
        }
        if (typeof (options) === 'undefined') {
          //December 21,1997
          options = {
            dateFormat: 'shortDate'
          };
        }
        return utils.fieldFormatter.getFormattedDate(new Date(v), options);
      } else {
        return "";
      }
    },

    _checkAliasName: function (lyrInfo, fieldName) {
      var fields = (lyrInfo.li && lyrInfo.li.fields) ? lyrInfo.li.fields : lyrInfo.fields;
      if (fields) {
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          if (field.name === fieldName) {
            return typeof (field.alias) !== 'undefined' ? field.alias : false;
          }
        }
        return false;
      }
    },

    _checkDomainField: function (lyrInfo, fieldName) {
      var fields = (lyrInfo.li && lyrInfo.li.fields) ? lyrInfo.li.fields : lyrInfo.fields;
      if (fields) {
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          if (field.name === fieldName) {
            return typeof (field.domain) !== 'undefined' ? field.domain : false;
          }
        }
        return false;
      }
    },

    _checkDateField: function(lyrInfo, fieldName){
      var fields = (lyrInfo.li && lyrInfo.li.fields) ? lyrInfo.li.fields : lyrInfo.fields;
      if (fields) {
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          if (field.name === fieldName) {
            if (field.type === 'esriFieldTypeDate') {
              return true;
            } else {
              return false;
            }
          }
        }
        return false;
      }
    },

    _checkDisplayField: function(displayFields, featureField){
      var includeField = true;
      if (displayFields) {
        for (var j = 0; j < displayFields.length; j++) {
          if (displayFields[j].name === featureField) {
            return displayFields[j];
          } else {
            includeField = false;
          }
        }
      }
      return includeField;
    },

    flashGraphics: function (graphics) {
      for (var i = 0; i < graphics.length; i++) {
        var g = graphics[i];
        this._flashFeature(g);
      }
    },

    _flashFeature: function (feature) {
      var symbol;
      if (feature.geometry) {
        var color = Color.fromHex(this._styleColor);
        var color2 = lang.clone(color);
        color2.a = 0.4;
        switch (feature.geometry.type) {
          case 'point':
            symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 15,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              color, 1),
              color2);
            break;
          case 'polyline':
            symbol = new SimpleLineSymbol(
              SimpleLineSymbol.STYLE_SOLID,
              color,
              3
            );
            break;
          case 'polygon':
            symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_DIAGONAL_CROSS,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              color, 2), color2
            );
            break;
        }
      }

      var g = new Graphic(feature.geometry, symbol);
      this.map.graphics.add(g);
      var dShape = g.getDojoShape();
      if (dShape) {
        fx.animateStroke({
          shape: dShape,
          duration: 900,
          color: {
            start: dShape.strokeStyle.color,
            end: dShape.strokeStyle.color
          },
          width: {
            start: 25,
            end: 0
          }
        }).play();
        setTimeout(this._clearFeature, 1075, g);
      }
    },

    _clearFeature: function (f) {
      var gl = f.getLayer();
      gl.remove(f);
    },

    _panToFeature: function (feature) {
      if (feature.geometry) {
        var geom = feature.geometry;
        if (geom.type === 'polyline') {
          var path = geom.paths[Math.ceil(geom.paths.length / 2) - 1];
          var g = path[Math.ceil((path.length - 1) / 2)];
          geom = new Point(g[0], g[1], geom.spatialReference);
        }
        if (geom.type !== 'point') {
          geom = geom.getExtent().getCenter();
        }
        this._pan(feature, geom).then(lang.hitch(this, function () {
          this._flashFeature(feature);
          if ((feature._layer && feature._layer.infoTemplate) || feature.infoTemplate) {
            this.map.infoWindow.setFeatures([feature]);
            this.map.infoWindow.select(0);
            this.map.infoWindow.show(geom);
          }
        }));
      }
    },

    _pan: function (feature, centerPoint) {
      var def = new Deferred();
      if (this.showAllFeatures && !this.map.extent.contains(feature.geometry)) {
        this.map.centerAt(centerPoint).then(function (ext) {
          def.resolve(ext);
        });
      } else {
        def.resolve(undefined);
      }
      return def;
    },

    _getQuery: function (layerListLayer, fields, needsGeom) {
      var layerObject = layerListLayer.layerObject;
      var q = new Query();
      q.geometry = !this.showAllFeatures ? this.map.extent : null;
      q.outFields = fields;
      q.returnGeometry = needsGeom;
      var collectionTypes = ['collection', 'kml', 'geo_rss'];
      var isCollection = layerListLayer.selfType ? collectionTypes.indexOf(layerListLayer.selfType) > -1 :  false;
      //layer types from feature collection don't support where
      if (!isCollection && layerObject.url) {
        q.where = layerListLayer.filter ? layerListLayer.filter : "1=1";
      } else if (this.showAllFeatures && layerObject && layerObject.fullExtent) {
        //still need a way to support showing of all features
        q.geometry = layerObject.fullExtent;
      }
      return q;
    },

    countFeatures: function (layerListLayer) {
      if (!this.hidePanel) {
        var lyr = layerListLayer.layerObject;
        var node = this.config.countEnabled ? layerListLayer.node : layerListLayer.legendNode;
        var q = this._getQuery(layerListLayer);
        if (lyr.queryCount && lyr.visible) {
          lyr.queryCount(q, lang.hitch(this, function (r) {
            if (node) {
              var updateNode;
              if (this.config.countEnabled) {
                node.innerHTML = utils.localizeNumber(r);
                updateNode = node.parentNode;
              } else {
                updateNode = node.previousSibling;
              }
              this.updateExpand(updateNode, r === 0);
            }
          }));
        } else if (layerListLayer && layerListLayer.li && layerListLayer.li.url) {
          var url = layerListLayer.li.url;
          if (url.indexOf("MapServer") > -1 || url.indexOf("FeatureServer") > -1) {
            var qt = new QueryTask(url);
            qt.executeForIds(q).then(lang.hitch(this, function (ids) {
              if (node) {
                var updateNode;
                var length = ids ? ids.length : 0;
                if (this.config.countEnabled) {
                  node.innerHTML = utils.localizeNumber(length);
                  updateNode = node.parentNode;
                } else {
                  updateNode = node.previousSibling;
                }
                this.updateExpand(updateNode, length === 0);
              }
            }));
          }
        }
      }
    }
  });
});