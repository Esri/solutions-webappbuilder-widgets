/*global define,dijit */
/** @license
| Version 10.2
| Copyright 2013 Esri
|
| Licensed under the Apache License, Version 2.0 (the "License");
| you may not use this file except in compliance with the License.
| You may obtain a copy of the License at
|
|    http://www.apache.org/licenses/LICENSE-2.0
|
| Unless required by applicable law or agreed to in writing, software
| distributed under the License is distributed on an "AS IS" BASIS,
| WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
| See the License for the specific language governing permissions and
| limitations under the License.
*/
//============================================================================================================================//
define([
  "dojo/_base/declare",
  "jimu/BaseWidget",
  "jimu/dijit/TabContainer",
  'jimu/dijit/LoadingIndicator',
  "dojo/window",
  "dojo/_base/lang",
  "dojo/on",
  "dojo/dom-construct",
  "dijit/form/HorizontalSlider",
  "dojo/dom",
  "esri/request",
  "esri/toolbars/draw",
  "dojo/dom-class",
  "dojo/query",
  "esri/graphic",
  "esri/layers/GraphicsLayer",
  "esri/tasks/query",
  "esri/tasks/FeatureSet",
  "esri/tasks/ClosestFacilityParameters",
  "esri/tasks/ClosestFacilityTask",
  "esri/geometry",
  "dojo/_base/array",
  "jimu/dijit/Message",
  "esri/tasks/QueryTask",
  "dojo/dom-attr",
  "dojo/dom-style",
  "jimu/PanelManager",
  "dijit/form/Select",
  "dijit/form/NumberTextBox",
  "esri/layers/FeatureLayer",
  "dojox/timing",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/jsonUtils",
  "dojo/string",
  "esri/geometry/Point",
  "dojo/Deferred",
  "dojo/promise/all",
  "jimu/dijit/CheckBox",
  "esri/geometry/geometryEngine",
  "esri/geometry/scaleUtils",
  "esri/units",
  "esri/dijit/AttributeInspector",
  "dijit/TooltipDialog",
  "jimu/utils",
  "dijit/popup",
  "dojo/dom-geometry",
  "dojo/date/locale",
  "dojo/has",
  "dojo/sniff"
], function (
  declare,
  BaseWidget,
  JimuTabContainer,
  LoadingIndicator,
  dojoWindow,
  lang,
  on,
  domConstruct,
  HorizontalSlider,
  dom,
  esriRequest,
  Draw,
  domClass,
  query,
  Graphic,
  GraphicsLayer,
  Query,
  FeatureSet,
  ClosestFacilityParameters,
  ClosestFacilityTask,
  Geometry,
  array,
  Message,
  QueryTask,
  domAttr,
  domStyle,
  PanelManager,
  Select,
  NumberTextBox,
  FeatureLayer,
  Timing,
  SimpleRenderer,
  symbolJsonUtils,
  string,
  Point,
  Deferred,
  all,
  CheckBox,
  geometryEngine,
  scaleUtils,
  Units,
  AttributeInspector,
  TooltipDialog,
  jimuUtils,
  dojoPopup,
  domGeom,
  dateLocale,
  has
) {
  return declare([BaseWidget], {
    baseClass: 'jimu-widget-ServiceFeasibility',
    networkAnalysisJsonArray: null,
    arrayIntegerValues: null,
    arrayOtherValues: null,
    toolbar: null,
    selectLocationToolbar: null,
    pointBarrierClicked: false,
    polylineBarrierClicked: false,
    polygonBarrierClicked: false,
    selectLocationClicked: false,
    errorExist: false,
    infoPopupEnabled: false,
    isResultExist: false,
    pointBarriersArray: null,
    polylineBarriersArray: null,
    polygonBarriersArray: null,
    selectLocationArray: null,
    panelManager: null,
    viewWindowSize: null,
    selectLocationGraphicLayer: null,
    bufferGraphicLayerId: "bufferGraphicLayer",
    highlightGraphicLayerId: "highlightGraphicLayer",
    highlightGraphicLayer: null,
    businessesLayerDefaultExpression: null,
    IsIE: null,
    IsChrome: null,
    IsSafari: null,
    IsOpera: null,
    resultPanelIndex: 0,
    _businessDataSaved: false,
    _routeDataSaved: false,
    _isDescending: false,
    _routeLength: 0,
    _businessPassed: 0,

    postCreate: function () {
      this.loading = new LoadingIndicator({
        hidden: true
      });
      this._initializingNetworkAnalysisServiceData();
      this._initializingJimuTabContainer();
      this._initializingFindNearestOptions();
      this.findButton = domConstruct.create("div", {
        innerHTML: this.nls.FindButton,
        id: "btnFindButton",
        "class": "esriCTFindButton jimu-btn jimu-state-disabled"
      }, this.divFeasibilityButtons);
      this.clearButtonSearch = domConstruct.create("div", {
        innerHTML: this.nls.ClearButton,
        id: "btnClearButton",
        "class": "esriCTClearButton jimu-btn jimu-state-disabled"
      }, this.divFeasibilityButtons);
      this.IsOpera = !!window.opera || navigator.userAgent.indexOf(
        ' OPR/') >= 0;
      this.IsSafari = Object.prototype.toString.call(window.HTMLElement)
        .indexOf('Constructor') > 0;
      this.IsChrome = !!window.chrome && !this.IsOpera;
      this.IsIE = !!document.documentMode || false;
      if ((this.appConfig && this.appConfig.hasOwnProperty(
          "geometryService")) && (this.appConfig.geometryService ===
          null || this.appConfig.geometryService === "")) {
        this._showAlertMessage(this.nls.invalidGeometryService);
      } else if (!this._checkLayerAvailability(this.config.businessesLayerName) &&
        this.config.AllowBusinessOptional) {
        this._showAlertMessage(this.nls.businessLayerUnavailable);
      } else {
        this._initializeDrawTool();
        this._addLayer();
      }
      this._enhancedStyling();
      this._setDartBackgroudColor();
    },

    /**
    * This is a startup function for Service Feasibility widget
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    startup: function () {
      //set result list height on Widget load
      this._setResultListHeight();
      //handle window resize to set the height of resultList at runtime
      on(window, 'resize', lang.hitch(this, this._setResultListHeight));
      this.inherited(arguments);
      this.findButton.disabled = true;
      this.clearButtonSearch.disabled = true;
      this._createTimer();
      this._createRouteFeatureLayer();
      on(this.findButton, "click", lang.hitch(this, function () {

        if (!this.findButton.disabled) {
          domClass.add(this.saveLayercontentContainer,
            "esriCTHidePanel");
          domClass.add(this.saveToLayerContainer,
            "esriCTHidePanel");
          domClass.remove(this.divExportToLayerButtons,
            "esriCTHidePanel");
          this._routeLength = 0;
          this._businessPassed = 0;
          this._routeCost = 0;
          this.resultDisplayAttributes = [];
          domConstruct.empty(this.exportToCSVContainer);
          this._isDescending = false;
          this._enableWebMapPopup();
          this._disableAllControls();
          this.showLoadingIndicator();
          this._checkParameterValues();
          this._createBufferGeometry([this.locationPointGeometry], [
            this.config.facilitySearchDistance
          ], this.config.bufferEsriUnits, [this.map.extent.spatialReference
            .wkid
          ]);
        }
      }));
      on(this.clearButtonSearch, "click", lang.hitch(this, function () {
        this._onClearButtonClicked(true);
      }));
      this.viewWindowSize = dojoWindow.getBox();
      this.panelManager = PanelManager.getInstance();
      dom.byId(this.panelManager.panels[0].titleNode);
      this._createResultPanelButtons();
      this._initSortOrder();
      // if applied Theme is for widget is dart Theme and browser is IE9
      if (this.appConfig.theme.name === "DartTheme" && has("ie") ===
        9) {
        this._setDartBackgroudColorForIE9();
      }
    },

    /**
    * This function will destroy Service Feasibility widget
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    destroy: function () {
      this._onClearButtonClicked(true);
      this._removeGraphicLayers();
      this.inherited(arguments);
    },

    /**
    * This function is a call back handler of Service Feasibility widget minimize event
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    onMinimize: function () {
      this._hideTooltipDialog();
    },

    /**
    * This function is a call back handler of Service Feasibility widget close event
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    onClose: function () {
      this._hideTooltipDialog();
    },

    /**
    * This function sets the height of result list
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _setResultListHeight: function () {
      var containerGeom;
      //set max-height of the result panel at runtime
      if (this.domNode && this.domNode.parentElement && this.domNode.parentElement
        .parentElement) {
        containerGeom = domGeom.position(this.domNode.parentElement.parentElement);
        if (containerGeom && containerGeom.h && dojoWindow.getBox().w >
          767) {
          domStyle.set(this.resultListContainer, "max-height", (
            containerGeom.h - 270) + "px");
        }
      }
    },

    /**
    * This function will create "clear" and "ExportToLayer" buttons in result panel
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _createResultPanelButtons: function () {
      var j;
      if (this.config.targetBusinessLayer || (this.config.targetRouteLayer &&
          this.routeFeatureLayer.objectIdField && this.routeFeatureLayer
          .objectIdField !== "")) {
        this.ExportToLayer = domConstruct.create("div", {
          innerHTML: this.nls.ExportToLayer,
          "class": "ExportToLayer jimu-btn"
        }, this.divExportToLayerButtons);
        on(this.ExportToLayer, "click", lang.hitch(this, function () {
          if (this.config.targetBusinessLayer !== "") {
            if (!this._checkLayerAvailability(this.config.targetBusinessLayer)) {
              this._showAlertMessage(this.nls.targetBusinessLayerUnavailable);
            } else if (!this._validateEditCapabilities(this.config
                .targetBusinessLayer)) {
              this._showAlertMessage(this.nls.targetBusinessLayerUneditable);
            }
          }
          if (this.config.targetRouteLayer !== "") {
            if (!this._checkLayerAvailability(this.config.targetRouteLayer)) {
              this._showAlertMessage(this.nls.targetRouteLayerUnavailable);
            } else if (!this._validateEditCapabilities(this.config
                .targetRouteLayer)) {
              this._showAlertMessage(this.nls.targetRouteLayerUneditable);
            }
          }
          this.saveLayerClicked = true;
          this.isResultExist = false;
          this._switchToResultPanel();
          this._onSaveToLayerClick();
          domClass.add(this.divExportToLayerButtons,
            "esriCTHidePanel");
        }));
        if (this.ExportToLayer) {
          domStyle.set(this.ExportToLayer, "display", "none");
        }
      }
      this.clearButton = domConstruct.create("div", {
        innerHTML: this.nls.ClearButton,
        "class": "jimu-btn ExportToLayer"
      }, this.divExportToLayerButtons);
      on(this.clearButton, "click", lang.hitch(this, function () {
        this._onClearButtonClicked(true);
        for (j = 0; j < this.tabContainer.controlNodes.length; j++) {
          if (this.tabContainer.controlNodes[j].innerHTML ===
            this.nls.searchContainerHeading) {
            domClass.remove(this.tabContainer.controlNodes[j],
              "jimu-tab>.control>.tab.jimu-state-selected+.tab"
            );
            domClass.replace(this.tabContainer.controlNodes[j],
              "tab jimu-vcenter-text jimu-state-selected",
              "tab jimu-vcenter-text");
            domStyle.set(this.tabSearch, "display", "block");
          } else if (this.tabContainer.controlNodes[j].innerHTML ===
            this.nls.resultsContainerHeading) {
            domClass.replace(this.tabContainer.controlNodes[j],
              "tab jimu-vcenter-text",
              "tab jimu-vcenter-text jimu-state-selected");
            domStyle.set(this.tabContainer.tabs[j].content,
              "display", "none");
            domStyle.set(this.tabResults, "display", "none");
          }
        }
      }));
    },

    /**
    * This function will create tooltip dialog for sorting in result panel
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _initSortOrder: function () {
      var name = "businessSort_" + jimuUtils.getRandomString();
      this.ascendingButton.name = name;
      this.descendingButton.name = name;
      this.sortOrderTooltipDialog = new TooltipDialog({
        content: this.sortTooltip
      });
      on(this.sortOrderIcon, "click", lang.hitch(this, function () {
        if (this.sortOrderTooltipDialog.isOpen) {
          this._hideTooltipDialog();
        } else {
          //display sorting options tooltip
          this._showTooltipDialog();
        }
      }));
      on(this.ascendingButton, "click", lang.hitch(this, function () {
        this._isDescending = false;
        this._hideTooltipDialog();
        this._businesspassedAscOrder();
      }));
      on(this.descendingButton, "click", lang.hitch(this, function () {
        this._isDescending = true;
        this._hideTooltipDialog();
        this._businesspassedDescOrder();
      }));
      //close the tooltip when clicked outside of the popup
      on(document.body, "click", lang.hitch(this, function (event) {
        var target = event.target || event.srcElement;
        if (!(this.sortOrderIcon === target || this.ascendingButton ===
            target || this.descendingButton === target)) {
          if (this.sortOrderTooltipDialog.isOpen) {
            this._hideTooltipDialog();
          }
        }
      }));
    },

    /**
    * This function will hide tooltip dialog for sorting.
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _hideTooltipDialog: function () {
      if (this.sortOrderTooltipDialog) {
        dojoPopup.close(this.sortOrderTooltipDialog);
        this.sortOrderTooltipDialog.isOpen = false;
      }
    },

    /**
    * This function will show tooltip dialog for sorting.
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _showTooltipDialog: function () {
      var args = {
        popup: this.sortOrderTooltipDialog,
        around: this.sortOrderIcon,
        orient: ['after-centered', 'below']
      };
      if (this._isDescending) {
        this.descendingButton.checked = true;
      } else {
        this.ascendingButton.checked = true;
      }
      dojoPopup.open(args);
      this.sortOrderTooltipDialog.isOpen = true;
    },


    /**
    * This function will initialize draw toolbar
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializeDrawTool: function () {
      this.toolbar = new Draw(this.map);
      on(this.toolbar, "draw-end", lang.hitch(this, function (evt) {
        if (this.selectLocationClicked) {
          this._addSelectLocationGraphic(evt);
        } else {
          this._addBarrierGraphic(evt);
        }
      }));
    },

    /**
    * Add graphic layers on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addLayer: function () {
      this.bufferGraphicLayer = new GraphicsLayer();
      this.bufferGraphicLayer.id = this.bufferGraphicLayerId;
      this.map.addLayer(this.bufferGraphicLayer);
      this.highlightGraphicLayer = new GraphicsLayer();
      this.highlightGraphicLayer.id = this.highlightGraphicLayerId;
      this.barrierGraphicLayer = new GraphicsLayer();
      this.map.addLayer(this.barrierGraphicLayer);
      this.selectLocationGraphicLayer = new GraphicsLayer();
      this.map.addLayer(this.selectLocationGraphicLayer);
    },

    /**
    * This function will convert network analysis data into json.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializingNetworkAnalysisServiceData: function () {
      var requestArguments;
      // checking whether closest facility url exists in config
      if (this.config && this.config.closestFacilityURL) {
        requestArguments = {
          url: this.config.closestFacilityURL,
          content: {
            f: "json"
          },
          handleAs: "json",
          callbackParamName: "callback",
          timeout: 20000
        };
        esriRequest(requestArguments).then(lang.hitch(this, function (
          response) {
          if (this.loading) {
            this.showLoadingIndicator();
          }
          this.networkAnalysisJsonArray = response;
          this._initializingAttributeParameterValues();
        }), lang.hitch(this, function () {
          this._showAlertMessage(this.nls.noServiceInfo);
          this.widgetManager.destroyWidget(this);
          if (this.panelManager.getPanelById(this.id + '_panel')) {
            this.panelManager.closePanel(this.id + '_panel');
            this.panelManager.destroyPanel(this.id + '_panel');
          }
          this._hideLoadingIndicator();
        }));
      }
    },

    /**
    * This function will initialize jimu tab container.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializingJimuTabContainer: function () {
      this.tabContainer = new JimuTabContainer({
        tabs: [{
          title: this.nls.searchContainerHeading,
          content: this.tabSearch,
          selected: true
        }, {
          title: this.nls.resultsContainerHeading,
          content: this.tabResults,
          selected: false
        }]
      }, this.tabContainerServiceFeasibility);
      this._switchToResultPanel();
      this.tabContainer.startup();
    },

    /**
    * This function will initialize options in select for Find Nearest.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializingFindNearestOptions: function () {
      var findNearestOptions, arrayFindNearestOptions = [],
        k, labelDiv,
        labelValue, selectOptionArr = [],
        selectListDiv;
      if (this.config && this.config.accessPointsLayersName) {
        domClass.remove(this.selectFindNearestDropdownDiv,
          "esriCTHidePanel");
        findNearestOptions = this.config.accessPointsLayersName;
        arrayFindNearestOptions = findNearestOptions.split(",");
        //Looping through the Nearest Options to create options in a select.
        for (k = 0; k < arrayFindNearestOptions.length; k++) {
          if (arrayFindNearestOptions.hasOwnProperty(k) &&
            arrayFindNearestOptions[k] !== "") {
            selectOptionArr.push({
              "label": arrayFindNearestOptions[k],
              "value": arrayFindNearestOptions[k]
            });
          }
        }
        selectListDiv = domConstruct.create("div", {
          "class": "esriCTFindNearestDropdown"
        }, this.selectFindNearest);
        this.findNearestList = new Select({
          "options": selectOptionArr,
          "title": this.nls.findNearest
        }, selectListDiv);

        labelDiv = query(".esriCTFindNearest", this.divFindNearest)[0];
        this.resultPanelIndex = (this.resultPanelIndex + 1);
        if (labelDiv && this.config.AllowedAccessPointCheckBoxChecked) {
          labelValue = "";
          labelValue = (this.resultPanelIndex) + ".  " + this.nls.findNearest;
          labelDiv.innerHTML = labelValue;
          domAttr.set(labelDiv, "title", this.nls.findNearest);
          this.resultPanelIndex = (this.resultPanelIndex + 1);
        } else {
          domStyle.set(this.divFindNearest, "display", "none");
        }
        this._setLayerForDropdown(this.findNearestList.value);
        on(this.findNearestList, "change", lang.hitch(this, function (
          value) {
          if (this.businessInfluenceValue) {
            this.businessInfluenceValue.length = 0;
            if (this.findButton.disabled === true && this.selectLocationArray &&
              this.selectLocationArray.length > 0) {
              this.findButton.disabled = false;
              domClass.remove(this.findButton,
                "jimu-state-disabled");
            }
            this._setLayerForDropdown(value);
          }
        }));
      }

    },

    /**
    * This function will create feature layer for route
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createRouteFeatureLayer: function () {
      var routeSymbolData, featureCollection = {},
        lineSymbol, rendererObj, outFields = [];
      this.outfields = [];
      routeSymbolData = this._getSymbolJson("routeSymbol");
      lineSymbol = this._createGraphicFromJSON(routeSymbolData);
      rendererObj = new SimpleRenderer(lineSymbol);
      if (this.config.targetRouteLayer !== "") {
        if (this.routeLayer && this.routeLayer.layerObject) {
          outFields = array.map(this.routeLayer.layerObject.fields,
            function (field) {
              return field.name;
            });
        }
      }
      featureCollection.layerDefinition = {
        "id": 0,
        "name": "Route Layer",
        "type": "Feature Layer",
        "displayField": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.displayField : "",
        "description": "",
        "copyrightText": "",
        "relationships": [],
        "geometryType": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.geometryType : "esriGeometryPolyline",
        "minScale": 0,
        "maxScale": 0,
        "extent": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.fullExtent : null,
        "drawingInfo": {
          "renderer": rendererObj,
          "transparency": 0,
          "labelingInfo": null
        },
        "hasAttachments": true,
        "htmlPopupType": "esriServerHTMLPopupTypeAsHTMLText",
        "objectIdField": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.objectIdField : "",
        "globalIdField": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.globalIdField : "",
        "typeIdField": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.typeIdField : "",
        "fields": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.fields : [],
        "types": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.types : "",
        "templates": this.routeLayer && this.routeLayer.layerObject ?
          this.routeLayer.layerObject.templates : "",
        "capabilities": "Query,Editing"
      };
      //In case of range domain API requires range array to be available in domain,
      //so check if range array is not available add it to domain
      array.forEach(featureCollection.layerDefinition.fields, lang.hitch(
        this,
        function (field) {
          if (field && field.domain && field.domain.type ===
            "range") {
            if (!field.domain.range) {
              field.domain.range = [];
              if (field.domain.minValue) {
                field.domain.range.push(field.domain.minValue);
              }
              if (field.domain.maxValue) {
                field.domain.range.push(field.domain.maxValue);
              }
            }
          }
        }));
      this.routeFeatureLayer = new FeatureLayer(featureCollection, {
        outFields: outFields,
        id: "routeFeatureLayer"
      });
      this.routeFeatureLayer.visible = true;
      this.routeFeatureLayer.renderer = rendererObj;
      this.map.addLayer(this.routeFeatureLayer);
    },

    /**
    * This function will initialize business influence values.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializingAttributeParameterValues: function () {
      var attributeParameterValues, i, arrayindex, index,
        attributeindex;
      attributeParameterValues = this.config.attributeName;
      this.arrayIntegerValues = [];
      this.arrayOtherValues = [];
      this.businessInfluenceValue = [];
      this.textboxValues = [];
      this.attributeValues = [];
      if (this.config.customAttributeSelection) {
        //loop to create control for each attribute parameter name
        for (i = 0; i < attributeParameterValues.length; i++) {
          // if parameter type is restriction and allow user input is true then it will create both drop down as
          // well input slider field else if type is not defined and allow user input is true then only input slider
          // will be created and allow user input is false then value is pushed in array and passed internally
          if (attributeParameterValues[i].type === "Restriction" &&
            attributeParameterValues[i].allowUserInput) {
            // method to create drop down field for allow user input
            this._createDropDown(attributeParameterValues[i], i);
            // loop for traversing parameters in attributes parameters
            for (index in attributeParameterValues[i].parameters) {
              // if object array have index property then only
              if (attributeParameterValues[i].parameters.hasOwnProperty(
                  index)) {
                // if index is greater than 0 as on 0th index always allow user input value will exist
                if (index > 0) {
                  this._createRangeSlider(attributeParameterValues[i],
                    i, index);
                }
              }
            }
          } else if (attributeParameterValues[i].type === "" &&
            attributeParameterValues[i].allowUserInput) {
            arrayindex = 0;
            this._createRangeSlider(attributeParameterValues[i], i,
              arrayindex);
          } else {
            // loop for traversing parameters in attributes parameters
            for (attributeindex in attributeParameterValues[i].parameters) {
              // if object array have index property then only
              if (attributeParameterValues[i].parameters.hasOwnProperty(
                  attributeindex)) {
                this.attributeValues.push({
                  "attributeName": attributeParameterValues[i].name,
                  "parameterName": attributeParameterValues[i].parameters[
                    attributeindex].name,
                  "parameterValue": attributeParameterValues[i].parameters[
                    attributeindex].value
                });
              }
            }
            this.arrayIntegerValues.push(attributeParameterValues[i]);
          }
        }
      }
      this._setSearchPanelIndex();
      this._hideLoadingIndicator();
    },

    /**
    * This function will create indexes of search panel headings
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setSearchPanelIndex: function () {
      var labelDiv, labelValue, selectLocationLabelDiv,
        selectLocationLabelValue;
      labelDiv = query(".esriCTBarriersLabel", this.divDrawBarriersOnMap)[
        0];
      selectLocationLabelDiv = query(".esriCTLocationLabel", this.divSelectLocationOnMap)[
        0];
      if (this.config && this.config.AllowedBarriersCheckBoxChecked) {
        if (labelDiv) {
          domStyle.set(this.divDrawBarriersOnMap, "display", "block");
          labelValue = "";
          labelValue = this.resultPanelIndex + ".  " + this.nls.DrawBarriersOnMap;
          if (labelValue) {
            labelDiv.innerHTML = labelValue;
            domAttr.set(labelDiv, "title", this.nls.DrawBarriersOnMap);
            this.resultPanelIndex = (this.resultPanelIndex + 1);
          }
        }
      } else {
        domStyle.set(this.divDrawBarriersOnMap, "display", "none");
      }
      if (selectLocationLabelDiv) {
        selectLocationLabelValue = "";
        selectLocationLabelValue = this.resultPanelIndex + ".  " +
          this.nls.SelectLocationOnMap;
        domAttr.set(selectLocationLabelDiv, "title", this.nls.SelectLocationOnMap);
        if (selectLocationLabelValue) {
          selectLocationLabelDiv.innerHTML = selectLocationLabelValue;
          this.resultPanelIndex = (this.resultPanelIndex + 1);
        }
      }
    },

    /**
    * This function will create the Range Slider.
    * param{object}attributeParameterValues: object of attributeParameterValue coming from config.json
    * param{object}attrIndex: attribute index
    * param{object}paramIndex: parameter index
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createRangeSlider: function (attributeParameterValue, attrIndex,
      paramIndex) {
      var tempValue, maxValue, minValue, textbox, slider,
        businessContainer, influenceInput, buisnessInfluenceSlider;
      if (attributeParameterValue.parameters[paramIndex] &&
        attributeParameterValue.parameters[paramIndex].value) {
        tempValue = (attributeParameterValue.parameters[paramIndex].value
          .split(","));
      }
      if (tempValue && tempValue.length < 2) {
        tempValue = attributeParameterValue.parameters[paramIndex].value;
        maxValue = parseFloat(tempValue);
        minValue = 0;
      } else {
        maxValue = parseFloat(tempValue[1], 10);
        minValue = parseFloat(tempValue[0], 10);
      }
      textbox = new NumberTextBox({
        "name": attributeParameterValue.parameters[paramIndex].name,
        "id": attributeParameterValue.parameters[paramIndex].name,
        "value": minValue,
        "class": "esriCTTxtboxParamValue esriCTAttributeParamsValueTextbox",
        "required": true,
        "trim": true,
        "intermediateChanges": true,
        "constraints": {
          min: minValue,
          max: maxValue
        }
      });
      slider = new HorizontalSlider({
        "class": "esriCTSlider",
        "name": "slider",
        "id": attributeParameterValue.parameters[paramIndex].name +
          attrIndex + "Slider",
        "value": minValue,
        "minimum": minValue,
        "maximum": maxValue,
        "discreteValues": maxValue + 1
      });
      slider.startup();
      domAttr.set(textbox.domNode, "title", attributeParameterValue.parameters[
        paramIndex].name);

      domAttr.set(textbox.domNode, "name", attributeParameterValue.parameters[
        paramIndex].name);
      domAttr.set(textbox.domNode, "attributeName",
        attributeParameterValue.name);

      this._attachTextBoxEvents(textbox, slider, minValue, maxValue);

      if (paramIndex > 0) {
        businessContainer = domConstruct.create("div", {
          "class": "esriCTBusinessInfluence esriCTMarginL25"
        });
        domConstruct.create("div", {
          "class": "esriCTBusinessInfluenceValue",
          "innerHTML": attributeParameterValue.parameters[
            paramIndex].name,
          "title": attributeParameterValue.parameters[paramIndex]
            .name
        }, businessContainer);

      } else {
        businessContainer = domConstruct.create("div", {
          "class": "esriCTBusinessInfluence"
        });
        domConstruct.create("div", {
          "class": "esriCTBusinessInfluenceValue",
          "innerHTML": this.resultPanelIndex + ". " +
            attributeParameterValue.parameters[paramIndex].name,
          "title": attributeParameterValue.parameters[paramIndex]
            .name
        }, businessContainer);
        this.resultPanelIndex = (this.resultPanelIndex + 1);
      }

      influenceInput = domConstruct.create("div", {
        "class": "esriCTBusinessInfluenceInput"
      }, businessContainer);
      influenceInput.appendChild(textbox.domNode);
      buisnessInfluenceSlider = domConstruct.create("div", {
        "class": "esriCTBusinessInfluenceSlider"
      }, businessContainer);
      buisnessInfluenceSlider.appendChild(slider.domNode);
      this.divBuisnessInfluence.appendChild(businessContainer);
    },

    /**
    * This function will bind the events with business influence textbox
    * param{object}textbox: object of number textbox for business influence parameter
    * param{object}slider: object of range slider for business influence parameter
    * param{object}minValue: minimum value attribute set for range slider
    * param{object}maxValue: maximum value attribute set for range slider
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _attachTextBoxEvents: function (textbox, slider, minValue, maxValue) {
      on(textbox, "change", lang.hitch(this, function () {
        if (isNaN(textbox.value)) {
          slider.attr("value", minValue);
        }
        if (parseFloat(textbox.value) >= minValue && parseFloat(
            textbox.value) <= maxValue && !isNaN(parseFloat(
            textbox.value))) {
          // enable the find button when disabled and when location is already added to map
          if (this.findButton.disabled === true && this.selectLocationArray &&
            this.selectLocationArray.length > 0) {
            this.findButton.disabled = false;
            domClass.remove(this.findButton,
              "jimu-state-disabled");
          }
          slider.attr("value", textbox.value);
        } else {
          this.findButton.disabled = true;
          domClass.add(this.findButton, "jimu-state-disabled");
        }
      }));
      on(slider, "change", lang.hitch(this, function (value) {
        // enable the find button when disabled and when location is already added to map
        if (this.findButton.disabled === true && (this.selectLocationArray &&
            this.selectLocationArray.length > 0)) {
          this.findButton.disabled = false;
          domClass.remove(this.findButton,
            "jimu-state-disabled");
        }
        if (this._sliderChangeTimer) {
          if (textbox) {
            textbox.set("value", value);
            clearTimeout(this._sliderChangeTimer);
          }
        }
        this._sliderChangeTimer = setTimeout(function () {
          if (textbox) {
            textbox.set("value", value);
          }
        }, 100);
      }));
    },

    /**
    * This function creates a Drop Down for numeric parameter value input.
    * param{object}attributeParameterValues: object of attributeParameterValue coming from config.json
    * param{object}index: index of loop for creating business influence parameters
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createDropDown: function (attributeParameterValues, index) {
      var selectValue, selectOptionArray, selectContainer,
        selectDropdownList, k, selectOptionArr = [],
        optionArray, attributeParamList;
      selectContainer = domConstruct.create("div", {
        "class": "esriCTBusinessDropdownContainer"
      }, this.divBuisnessInfluence);
      domConstruct.create("div", {
        "class": "esriCTBusinessDropdownLabel esriCTEllipsisForLabel",
        innerHTML: this.resultPanelIndex + ". " +
          attributeParameterValues.name,
        "title": attributeParameterValues.name
      }, selectContainer);
      this.resultPanelIndex = (this.resultPanelIndex + 1);
      selectDropdownList = domConstruct.create("div", {
        "class": "esriCTBusinessDropdownValue"
      }, selectContainer);
      attributeParamList = domConstruct.create("div", {
        "class": "esriCTBusinessDropdownValue"
      }, selectDropdownList);
      optionArray = this.config.attributeValueLookup;
      selectOptionArray = optionArray.split(",");
      // looping to push all the values with label in an array to create options for business influence dropdown
      for (k = 0; k < selectOptionArray.length; k++) {
        if (selectOptionArray.hasOwnProperty(k)) {
          selectOptionArr.push({
            "label": selectOptionArray[k],
            "value": selectOptionArray[k]
          });
        }
      }
      selectValue = new Select({
        "id": attributeParameterValues.name + index,
        "options": selectOptionArr,
        "class": "esriCTDropdownValues esriCTAttributeParamsVal",
        "name": attributeParameterValues.name
      }, attributeParamList);
      domClass.add(selectValue, "esriCTAttributeParamsVal");
      domAttr.set(selectValue, "title", attributeParameterValues.parameters[
        0].name);
      domAttr.set(selectValue.domNode, "name",
        attributeParameterValues.name);
      domAttr.set(selectValue.domNode, "attributeName",
        attributeParameterValues.name);
      domAttr.set(selectValue.domNode, "defaultValue",
        attributeParameterValues.parameters[0].value);
      on(selectValue, "change", lang.hitch(this, function () {
        // enable the find button when disabled and when location is already added to map
        if (this.selectLocationArray && this.selectLocationArray
          .length > 0) {
          this.findButton.disabled = false;
          domClass.remove(this.findButton,
            "jimu-state-disabled");
        }
      }));
      selectValue.set("value", attributeParameterValues.parameters[0]
        .value);
    },

    /**
    * This function checks the parameter value for business influence.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _checkParameterValues: function () {
      var i, numberTxtNode, dropDownCount, numberTxtbox,
        numberSliderNode, numberSliderbox;
      if (this.businessInfluenceValue) {
        this.businessInfluenceValue.length = 0;
      }
      numberTxtNode = query(".esriCTTxtboxParamValue");
      //numberTxtbox = query(".dijitReset .dijitInputInner", numberTxtNode[0]);
      dropDownCount = query(".esriCTDropdownValues");
      // push each business influence text box's attributes into an array
      array.forEach(numberTxtNode, lang.hitch(this, function (node) {
        numberTxtbox = query(".dijitReset .dijitInputInner",
          node);
        this.businessInfluenceValue.push({
          "parameterValue": numberTxtbox[0].value,
          "parameterName": node.title,
          "attributeName": domAttr.get(node,
            "attributeName")
        });

      }));
      // push each business influence dropdown attributes into an array
      array.forEach(dropDownCount, lang.hitch(this, function (dropDown) {
        if (dropDown) {
          this.businessInfluenceValue.push({
            "parameterValue": dropDown.textContent,
            "parameterName": dropDown.title,
            "attributeName": domAttr.get(dropDown,
              "attributeName")
          });
        }
      }));
      // if attributes array for allow user input false value in not null then
      // merge it with allow user input true array which is final array for calculating the buffer
      if (this.attributeValues && this.attributeValues.length > 0) {
        // loop for iterating the values in array and pushing them in single business influence array
        for (i = 0; i < this.attributeValues.length; i++) {
          this.businessInfluenceValue.push(this.attributeValues[i]);
        }
      }

      numberSliderNode = query(".esriCTBusinessInfluenceSlider");
      // loop for traversing all the sliders in result panel and disabling once run analysis completed
      array.forEach(numberSliderNode, lang.hitch(this, function (
        sliderNode) {
        // if sliderNode parent node found then only
        if (sliderNode) {
          numberSliderbox = query(".dijitSlider", sliderNode);
          // if sliderNode node found inside sliderNode parent node then disable it
          if (numberSliderbox) {
            dijit.byId(numberSliderbox[0].id).disabled = true;
          }
        }
      }));

      array.forEach(numberTxtNode, lang.hitch(this, function (
        inputNode) {
        // if inputNode parent node found then only
        if (inputNode) {
          numberTxtbox = query(".dijitReset .dijitInputInner",
            inputNode);
          // if inputNode node found inside inputNode parent node then disable it
          if (numberTxtbox) {
            dijit.byId(numberTxtbox[0].id).disabled = true;
          }
        }
      }));
    },

    /**
    * This function will execute when user clicked on Point barrier.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onPointBarrierClicked: function () {
      if (!this.pointBarrierClicked) {
        this.pointBarrierClicked = true;
        this.polylineBarrierClicked = false;
        this.polygonBarrierClicked = false;
        this.selectLocationClicked = false;
        this._disableWebMapPopup();
        domClass.replace(this.pointImageContainer,
          "esriCTImgPointSelected", "esriCTImgPoint");
        this.toolbar.activate(Draw.POINT);
        this._checkForGeometry();
      } else {
        this.pointBarrierClicked = false;
        this._enableWebMapPopup();
        domClass.replace(this.pointImageContainer, "esriCTImgPoint",
          "esriCTImgPointSelected");
        if (this.toolbar._geometryType === "point") {
          this.toolbar.deactivate();
        }
      }
    },

    /**
    * This function will execute when user clicked on Polyline Barrier.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onPolylineBarrierClicked: function () {
      if (!this.polylineBarrierClicked) {
        this.polylineBarrierClicked = true;
        // set other barriers flags and location flag to false
        this.polygonBarrierClicked = false;
        this.pointBarrierClicked = false;
        this.selectLocationClicked = false;
        this._disableWebMapPopup();
        domClass.replace(this.polylineImageContainer,
          "esriCTImgPolylineSelected", "esriCTImgPolyline");
        this.toolbar.activate(Draw.POLYLINE);
        this._checkForGeometry();
      } else {
        this.polylineBarrierClicked = false;
        this._enableWebMapPopup();
        domClass.replace(this.polylineImageContainer,
          "esriCTImgPolyline", "esriCTImgPolylineSelected");
        if (this.toolbar._geometryType === "polyline") {
          this.toolbar.deactivate();
        }
      }
    },

    /**
    * This function will execute when user clicked on Polygon Barrier.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onPolygonBarrierClicked: function () {
      if (!this.polygonBarrierClicked) {
        this.polygonBarrierClicked = true;
        // set other barriers flags and location flag to false
        this.polylineBarrierClicked = false;
        this.pointBarrierClicked = false;
        this.selectLocationClicked = false;
        this._disableWebMapPopup();
        domClass.replace(this.polygonImageContainer,
          "esriCTImgPolygonSelected", "esriCTImgPolygon");
        this.toolbar.activate(Draw.POLYGON);
        this._checkForGeometry();
      } else {
        this.polygonBarrierClicked = false;
        this._enableWebMapPopup();
        domClass.replace(this.polygonImageContainer,
          "esriCTImgPolygon", "esriCTImgPolygonSelected");
        if (this.toolbar._geometryType === "polygon") {
          this.toolbar.deactivate();
        }
      }
    },

    /**
    * This function will execute when user clicked on Select Location.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onSelectLocationClicked: function () {
      if (!this.selectLocationClicked) {
        this.selectLocationClicked = true;
        // set barriers flags to false
        this.polylineBarrierClicked = false;
        this.polygonBarrierClicked = false;
        this.pointBarrierClicked = false;
        this._disableWebMapPopup();
        domClass.replace(this.imgSelectLocationDojo,
          "esriCTImgLocationSelected", "esriCTimgSelectLocation");
        this.toolbar.activate(Draw.POINT);
        this._checkForGeometry();
      } else {
        this.selectLocationClicked = false;
        this._enableWebMapPopup();
        domClass.replace(this.imgSelectLocationDojo,
          "esriCTimgSelectLocation", "esriCTImgLocationSelected");
        if (this.toolbar._geometryType === "point") {
          this.toolbar.deactivate();
        }
      }
    },

    /**
    * This function checks the geometry of location and geometry for each barriers
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _checkForGeometry: function () {
      if (!this.pointBarrierClicked) {
        this.pointBarrierClicked = false;
        domClass.replace(this.pointImageContainer, "esriCTImgPoint",
          "esriCTImgPointSelected");
      }
      if (!this.polylineBarrierClicked) {
        this.polylineBarrierClicked = false;
        domClass.replace(this.polylineImageContainer,
          "esriCTImgPolyline", "esriCTImgPolylineSelected");
      }
      if (!this.polygonBarrierClicked) {
        this.polygonBarrierClicked = false;
        domClass.replace(this.polygonImageContainer,
          "esriCTImgPolygon", "esriCTImgPolygonSelected");
      }
      if (!this.selectLocationClicked) {
        this.selectLocationClicked = false;
        domClass.replace(this.imgSelectLocationDojo,
          "esriCTimgSelectLocation", "esriCTImgLocationSelected");
      }
    },

    /**
    * This function will add barriers to the map.
    * param{object}evt: draw-end event object.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addBarrierGraphic: function (evt) {
      if (!this.barrierExists) {
        this.barrierExists = true;
        this.pointBarriersArray = [];
        this.polylineBarriersArray = [];
        this.polygonBarriersArray = [];
      }
      this._addDataInBarrierArray(evt);
      if (this.selectLocationArray && this.selectLocationArray.length >
        0) {
        this.findButton.disabled = false;
        domClass.remove(this.findButton, "jimu-state-disabled");
      }
      // enable clear button when disabled
      if (this.clearButtonSearch.disabled) {
        this.clearButtonSearch.disabled = false;
        domClass.remove(this.clearButtonSearch, "jimu-state-disabled");
      }
    },

    /**
    * This function will check and add selected barrier on map
    * param{object}evt: draw-end event object
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addDataInBarrierArray: function (evt) {
      var pointBarrierSymbolData, pointBarrierSymbol,
        polylineBarrierData, polylineBarrierSymbol,
        polygonBarrierSymbol, polygonBarrierData, symbol, graphic;
      switch (evt.geometry.type) {
        case "point":
          pointBarrierSymbolData = this._getSymbolJson(
            "pointBarrierSymbol");
          pointBarrierSymbol = this._createGraphicFromJSON(
            pointBarrierSymbolData);
          symbol = pointBarrierSymbol;
          this.pointBarriersArray.push(evt.geometry);
          break;
        case "polyline":
          polylineBarrierData = this._getSymbolJson(
            "lineBarrierSymbol");
          polylineBarrierSymbol = this._createGraphicFromJSON(
            polylineBarrierData);
          symbol = polylineBarrierSymbol;
          this.polylineBarriersArray.push(evt.geometry);
          break;
        case "polygon":
          polygonBarrierData = this._getSymbolJson(
            "polygonBarrierSymbol");
          polygonBarrierSymbol = this._createGraphicFromJSON(
            polygonBarrierData);
          symbol = polygonBarrierSymbol;
          this.polygonBarriersArray.push(evt.geometry);
          break;
      }
      graphic = new Graphic(evt.geometry, symbol);
      this.barrierGraphicLayer.add(graphic);
    },

    /**
    * This function will add the select location to the map.
    * param{object}evt: draw-end event object
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addSelectLocationGraphic: function (evt) {
      var selectLocationSymbol, graphic, pointLocationSymbolData;
      if (!this.appConfig.geometryService || (this.appConfig.geometryService ===
          null || this.appConfig.geometryService === "")) {
        this.findButton.disabled = true;
        domClass.add(this.findButton, "jimu-state-disabled");
      } else {
        this.selectLocationGraphicLayer.clear();
        this.selectLocationArray = [];
        if (this.config && this.config.symbol && this.config.symbol.length &&
          this.config.symbol.length > 0 && this.config.accessPointsLayersName
        ) {
          pointLocationSymbolData = this._getSymbolJson(
            "pointLocationSymbol");
          selectLocationSymbol = this._createGraphicFromJSON(
            pointLocationSymbolData);
          this.selectLocationArray.push(evt.geometry);
          graphic = new Graphic(evt.geometry, selectLocationSymbol);
          this.selectLocationGraphicLayer.add(graphic);
          if (this.selectLocationArray && this.selectLocationArray.length >
            0) {
            this.findButton.disabled = false;
            domClass.remove(this.findButton, "jimu-state-disabled");
          }
          if (this.clearButtonSearch) {
            this.clearButtonSearch.disabled = false;
            domClass.remove(this.clearButtonSearch,
              "jimu-state-disabled");
          }
          this.locationPointGeometry = graphic.geometry;
        }
      }
    },

    /**
    * This function reset all the controls to default
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onClearButtonClicked: function (clearBarrier) {
      this._enhancedStyling();
      domClass.remove(this.businessPassedDiv,
        "esriCTHideBusinessPassedDiv");
      domClass.remove(this.costHeadingDiv,
        "esriCTCostHeadingDivFullWidth");
      if (!this.clearButtonSearch.disabled || this.errorExist) {
        this._hideLoadingIndicator();
        this._enableWebMapPopup();
        this._clearLayerGraphics(clearBarrier);
        if (this.config.businessesLayerName !== this.config.targetBusinessLayer &&
          this.findNearestList.value.toString() !== this.config.businessesLayerName
        ) {
          this.businessLayer.layerObject.hide();
        }
        domStyle.set(this.businessTitleContainer, "display", "none");
        domStyle.set(this.resultContainer, "display", "none");
        domStyle.set(this.resultListContainer, "display", "none");
        if (this.ExportToLayer) {
          domStyle.set(this.ExportToLayer, "display", "none");
        }
        domClass.add(this.divExportToLayerButtons, "esriCTHidePanel");
        this.locationPointGeometry = null;
        this._disableBarrierControls();
        this.findNearestList.reset();
        this._setLayerForDropdown(this.findNearestList.value);
        this._disableAllControls();
        //reset the flag values to false
        this.errorExist = false;
        this.saveLayerClicked = false;
        this._businessDataSaved = false;
        this._routeDataSaved = false;
        this._isDescending = false;
        this.resultDisplayAttributes = [];
        domConstruct.empty(this.exportToCSVContainer);
        this._routeLength = 0;
        this._businessPassed = 0;
        this._routeCost = 0;
        this._resetBusinessInfluenceValues();
      }
    },

    /**
    * This function will clear all graphics from graphic layers.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _clearLayerGraphics: function (clearBarrier) {
      if (clearBarrier) {
        this.barrierGraphicLayer.clear();
      }
      this.selectLocationGraphicLayer.clear();
      if (this.routeFeatureLayer) {
        this.routeFeatureLayer.clear();
      }
      if (this.map.getLayer("bufferGraphicLayer")) {
        this.map.getLayer("bufferGraphicLayer").clear();
      }
      if (this.highlightGraphicLayer) {
        this.highlightGraphicLayer.clear();
      }
      if (this.businessLayer) {
        this.businessLayer.layerObject.setDefinitionExpression("1=2");
        this.businessLayer.layerObject.refresh();
      }
    },

    /**
    * This function will reset all the business influence values.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _resetBusinessInfluenceValues: function () {
      var resettxtbox, numberTxtbox, numberSliderNode,
        numberSliderbox, numberTextbox, attrParamSelectArray,
        defaultValue, attrParamSelect;
      resettxtbox = query(".esriCTTxtboxParamValue");
      // reset each business influence textbox value to default when clear button pressed
      array.forEach(resettxtbox, lang.hitch(this, function (node) {
        numberTxtbox = query(".dijitReset .dijitInputInner",
          node);
        numberTxtbox[0].value = numberTxtbox[0].defaultValue;
      }));
      // reset each business influence range slider value to default when clear button pressed
      numberSliderNode = query(".esriCTBusinessInfluenceSlider");
      array.forEach(numberSliderNode, lang.hitch(this, function (
        sliderNode) {
        if (sliderNode) {
          numberSliderbox = query(".dijitSlider", sliderNode);
          // if sliderNode node found inside sliderNode parent node then reset it
          if (numberSliderbox) {
            dijit.byId(numberSliderbox[0].id).reset();
          }
        }
      }));


      array.forEach(resettxtbox, lang.hitch(this, function (inputNode) {
        // if inputNode parent node found then only
        if (inputNode) {
          numberTextbox = query(".dijitReset .dijitInputInner",
            inputNode);
          // if inputNode node found inside inputNode parent node then disable it
          if (numberTextbox) {
            dijit.byId(numberTextbox[0].id).reset();
          }
        }
      }));

      attrParamSelectArray = query(".esriCTAttributeParamsVal");
      array.forEach(attrParamSelectArray, lang.hitch(this, function (
        selectNode) {
        // if inputNode parent node found then only
        if (selectNode) {
          defaultValue = domAttr.get(selectNode, "defaultValue");
          if (defaultValue && defaultValue !== "") {
            attrParamSelect = dijit.byId(selectNode.id);
            attrParamSelect.set("value", defaultValue);
          }
        }
      }));
    },

    /**
    * This function will remove all graphic layers from map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _removeGraphicLayers: function () {
      if (this.bufferGraphicLayer) {
        this.map.removeLayer(this.bufferGraphicLayer);
      }
      if (this.highlightGraphicLayer) {
        this.map.removeLayer(this.highlightGraphicLayer);
      }
      if (this.selectLocationGraphicLayer) {
        this.map.removeLayer(this.selectLocationGraphicLayer);
      }
      if (this.barrierGraphicLayer) {
        this.map.removeLayer(this.barrierGraphicLayer);
      }
      if (this.routeFeatureLayer) {
        this.map.removeLayer(this.routeFeatureLayer);
      }
    },

    /**
    * This function will disable barriers and location controls
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _disableBarrierControls: function () {
      //disable the point barrier control if selected
      if ((this.pointBarriersArray && this.pointBarriersArray.length >
          0) || this.pointBarrierClicked) {
        this.pointBarriersArray.length = 0;
        this.pointBarrierClicked = false;
      }
      //disable the polyline barrier control if selected
      if ((this.polylineBarriersArray && this.polylineBarriersArray.length >
          0) || this.polylineBarrierClicked) {
        this.polylineBarriersArray.length = 0;
        this.polylineBarrierClicked = false;
      }
      //disable the polygon barrier control if selected
      if ((this.polygonBarriersArray && this.polygonBarriersArray.length >
          0) || this.polygonBarrierClicked) {
        this.polygonBarriersArray.length = 0;
        this.polygonBarrierClicked = false;
      }
      //disable the select location control if selected
      if ((this.selectLocationArray && this.selectLocationArray.length >
          0) || this.selectLocationClicked) {
        this.selectLocationClicked = false;
        this.selectLocationArray.length = 0;
      }
    },

    /**
    * This function will enable the web map popup.
    **/
    _enableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(true);
      }
    },

    /**
    * This function will disable the web map popup.
    **/
    _disableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(false);
      }
    },

    /**
    * This function will create buffer geometry on the map.
    * param{array} geometry: An array which contains geometries.
    * param{integer} distance: buffer distance.
    * param{integer} unit: buffer unit.
    * param{integer} wkid: sptial reference constant.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createBufferGeometry: function (geometry, distance, unit) {
      var geometryBufferEng;
      try {
        geometryBufferEng = geometryEngine.buffer(geometry, distance,
          unit, true);
        if (geometryBufferEng && geometryBufferEng.length > 0 &&
          geometryBufferEng[0] && geometryBufferEng[0].rings.length >
          0) {
          this._addBufferGeometryOnMap(geometryBufferEng[0], geometry);
        } else {
          this._onBufferGeometryError();
          this._onClearButtonClicked(false);
          this._enableAllControls();
        }
      } catch (err) {
        this._showAlertMessage(err.message);
        this.errorExist = true;
        this._onClearButtonClicked(false);
        this._enableAllControls();
        this._hideLoadingIndicator();
      }
    },

    /**
    * This function will create the buffer on map
    * param{array} response: Buffer operation response
    * param{array} geometry: geometry sent to buffer operation
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addBufferGeometryOnMap: function (response, geometry) {
      var i, bufferResultGeometry, bufferGraphic, bufferSymbol,
        bufferSymbolData, arrayAccessPointsLayers = [],
        deferredArray = [],
        featuresList = [];
      // when buffer geomtery is point
      if (geometry && geometry[0] && geometry[0].type && geometry[0].type ===
        "point") {
        if (this.config && this.config.AllowedAccessPointCheckBoxChecked) {
          this._queryForFacilityFeatures(response, deferredArray,
            featuresList);
        } else {
          arrayAccessPointsLayers = this.config.accessPointsLayersName
            .split(",");
          for (i = 0; i < arrayAccessPointsLayers.length; i++) {
            if (arrayAccessPointsLayers.hasOwnProperty(i) &&
              arrayAccessPointsLayers[i] !== "") {
              this._setLayerForDropdown(arrayAccessPointsLayers[i]);
              this._queryForFacilityFeatures(response, deferredArray,
                featuresList);
            }
          }
        }
        all(deferredArray).then(lang.hitch(this, function () {
          try {
            this._getResultantRoutes(featuresList);
          } catch (error) {
            this.errorExist = true;
            this._onClearButtonClicked(false);
            this._showAlertMessage(error.message);
            this._enableAllControls();
            this._hideLoadingIndicator();
          }
        }), lang.hitch(this, function (error) {
          this.errorExist = true;
          this._onClearButtonClicked(false);
          this._showAlertMessage(error.message);
          this._enableAllControls();
          this._hideLoadingIndicator();
        }));
      } else {
        // when buffer geometry is polygon
        if (this.config && this.config.symbol && this.config.symbol
          .length && this.config.symbol.length > 0) {
          bufferSymbolData = this._getSymbolJson("bufferSymbol");
          bufferSymbol = this._createGraphicFromJSON(
            bufferSymbolData);
          bufferGraphic = new Graphic(response, bufferSymbol);
          if (this.bufferGraphicLayer.graphics.length > 0) {
            this.map.getLayer("bufferGraphicLayer").clear();
          }
          this.bufferGraphicLayer.add(bufferGraphic);
          bufferResultGeometry = response;
          this.map.setExtent(bufferResultGeometry.getExtent(), true);
          this._queryForBusinessData(bufferResultGeometry);
        }
      }
    },

    /**
    * This function will execute if any error occured while creating buffer geometries.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onBufferGeometryError: function () {
      this._onClearButtonClicked(false);
      this._enableAllControls();
      this.errorExist = true;
      this._showAlertMessage(this.nls.unableToCreateSearchBuffer);
      this._hideLoadingIndicator();
    },

    /**
    * This function will query for facility features lies within the given buffer
    * param{object}geometry: object containing information of buffer geometry.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _queryForFacilityFeatures: function (geometry, deferredArray,
      featuresList) {
      var queryFeature, queryTask;
      queryFeature = new Query();
      queryFeature.geometry = geometry;
      queryFeature.returnGeometry = true;
      queryFeature.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
      queryFeature.outFields = ["*"];
      if (this._existingDefinitionExpression) {
        queryFeature.where = this._existingDefinitionExpression;
      }
      queryTask = new QueryTask(this.layer);
      deferredArray.push(queryTask.execute(queryFeature, lang.hitch(
        this,
        function (
          results) {
          if (results !== null && results.features && results.features
            .length > 0) {
            array.forEach(results.features, lang.hitch(this,
              function (features) {
                featuresList.push(features);
              }));
          }
        }), lang.hitch(this, function (error) {
          this.errorExist = true;
          this._onClearButtonClicked(false);
          this._showAlertMessage(error.message);
          this._enableAllControls();
          this._hideLoadingIndicator();
        })));
    },

    /**
    * This function will set the parameters for closest facility task and call closest facility task to get closest route
    * @param{array}results: array containing the resultant features of query
    * @return{array}solve: array containing closest facility solve results
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _getResultantRoutes: function (results) {
      var facilityParams, incidents, facilities, locationGraphics,
        features = [],
        attributeParameterValues = [],
        pointLocation, closestFacilityTask, i, errorMsg = "";
      facilityParams = this._getFacilityParameters();
      // loop to push the each business influence value and each attributeName in attributeParameterValues
      if (this.businessInfluenceValue) {
        if (this.businessInfluenceValue.length > 0) {
          for (i = 0; i < this.businessInfluenceValue.length; i++) {
            attributeParameterValues.push({
              attributeName: this.businessInfluenceValue[i].attributeName,
              parameterName: this.businessInfluenceValue[i].parameterName,
              value: this.businessInfluenceValue[i].parameterValue
                .toString()
            });
          }

        }
      }
      if (this.config.travelModeSelection) {
        if (this.config.selectedTravelMode.TravelMode) {
          facilityParams.travelMode = JSON.parse(this.config
            .selectedTravelMode.TravelMode);
        } else if (this.config.selectedTravelMode.itemId) {
          facilityParams.travelMode = parseInt(this.config
            .selectedTravelMode.itemId, 10);
        }
      } else {
        facilityParams.attributeParameterValues =
          attributeParameterValues;
      }
      incidents = new FeatureSet();
      pointLocation = new Graphic(this.locationPointGeometry);
      features.push(pointLocation);
      incidents.features = features;
      facilityParams.incidents = incidents;
      facilities = new FeatureSet();
      locationGraphics = [];
      array.forEach(results, function (pointLocation) {
        locationGraphics.push(new Graphic(pointLocation.geometry));
      });
      facilities.features = locationGraphics;
      facilityParams.facilities = facilities;
      facilityParams.outSpatialReference = this.map.spatialReference;
      //set the closest facility task url from config
      closestFacilityTask = new ClosestFacilityTask(this.config.closestFacilityURL);
      // Return solve for closest facility task
      return closestFacilityTask.solve(facilityParams, lang.hitch(
        this,
        function (solveResults) {
          if (solveResults && solveResults.routes && solveResults
            .routes.length > 0 && solveResults.routes[0]) {
            this._showFinalRoute(solveResults.routes[0]);
          } else {
            this.errorExist = true;
            this._onClearButtonClicked(false);
            errorMsg = this.nls.unableToFindClosestFacility;
            this._showAlertMessage(errorMsg);
            this._enableAllControls();
            this._hideLoadingIndicator();
          }
        }), lang.hitch(this, function (error) {
          this.errorExist = true;
          this._onClearButtonClicked(false);
          errorMsg = (error && error.message ? error.message : "") +
          (error.details && error.details.length > 0 ? "\n" +
            error.details[0] : "");
          errorMsg = (errorMsg !== "") ? errorMsg : this.nls.unableToFindClosestFacility;
          if (errorMsg.length > 500) {
            errorMsg = errorMsg.substring(0, 500) + "...";
            this._showAlertMessage(errorMsg);
          } else {
            this._showAlertMessage(errorMsg);
          }
          this._enableAllControls();
          this._hideLoadingIndicator();
        }));
    },

    /**
    * This function will push the attribute parameters into an array.
    * @return{array} : array of attribute parameter values
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setAttributeParameterValues: function () {
      var attributeParameterValues = [],
        i, j;
      if (this.businessInfluenceValue) {
        if (this.businessInfluenceValue.length > 0) {
          // loop to push the each business influence value and each attributeName in attributeParameterValues
          for (i = 0; i < this.businessInfluenceValue.length; i++) {
            attributeParameterValues.push({
              attributeName: this.businessInfluenceValue[i].name,
              parameterName: this.businessInfluenceValue[i].label,
              value: this.businessInfluenceValue[i].value.toString()
            });
          }
        }
      }
      if (this.config && this.config.attributeName && this.config.attributeName
        .length > 0) {
        // looping to push each attribute parameter value in an array from config when "allow user input" is set to false
        for (j = 0; j < this.config.attributeName.length; j++) {
          if (this.config.attributeName[j].value !== "" && this.config
            .attributeName[j].allowUserInput === "false") {
            attributeParameterValues.push({
              attributeName: this.config.attributeName[j].name,
              parameterName: this.config.attributeName[j].displayLabel,
              value: this.config.attributeName[j].value.toString()
            });
          }
        }
      }
      return attributeParameterValues;
    },


    /**
    * This function will set the facility parameters for Closest facility Task and check for barriers
    * @return{array} : array of facility parameters
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _getFacilityParameters: function () {
      var facilityParams, pointbarriers, polylineBarriers,
        polygonBarriers, pointBarriersArr = [],
        polylineBarriersArr = [],
        polygonBarriersArr = [];
      facilityParams = new ClosestFacilityParameters();
      facilityParams.defaultCutoff = this.config.defaultCutoff;
      facilityParams.useHierarchy = false;
      facilityParams.returnIncidents = true;
      facilityParams.returnRoutes = true;
      facilityParams.returnFacilities = true;
      facilityParams.returnDirections = false;
      facilityParams.defaultTargetFacilityCount = 1;
      facilityParams.impedenceAttribute = this.config.impedanceAttribute;
      // check whether any barrier exists
      if (this.barrierExists && this.barrierExists === true) {
        facilityParams.returnBarriers = true;
      }
      pointbarriers = new FeatureSet();
      polylineBarriers = new FeatureSet();
      polygonBarriers = new FeatureSet();
      // check whether point barrier exists
      if (this.pointBarriersArray && this.pointBarriersArray.length >
        0) {
        // pushing each point barrier geometry in an array
        array.forEach(this.pointBarriersArray, lang.hitch(this,
          function (geom) {
            pointBarriersArr.push(new Graphic(geom));
          }));
        pointbarriers.features = pointBarriersArr;
        facilityParams.pointBarriers = pointbarriers;
        facilityParams.returnPointBarriers = true;
      }
      // check whether polyline barrier exists
      if (this.polylineBarriersArray && this.polylineBarriersArray.length >
        0) {
        // pushing each polyline barrier geometry in an array
        array.forEach(this.polylineBarriersArray, lang.hitch(this,
          function (geom) {
            polylineBarriersArr.push(new Graphic(geom));
          }));
        polylineBarriers.features = polylineBarriersArr;
        facilityParams.polylineBarriers = polylineBarriers;
        facilityParams.returnPolylineBarriers = true;
      }
      // check whether polygon barrier exists
      if (this.polygonBarriersArray && this.polygonBarriersArray.length >
        0) {
        // pushing each polygon barrier geometry in an array
        array.forEach(this.polygonBarriersArray, lang.hitch(this,
          function (geom) {
            polygonBarriersArr.push(new Graphic(geom));
          }));
        polygonBarriers.features = polygonBarriersArr;
        facilityParams.polygonBarriers = polygonBarriers;
        facilityParams.returnPolygonBarriers = true;
      }

      return facilityParams;
    },

    /**
    * This function will round of the value route length or cost
    * @params{string}result: string contains route length or cost
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _calculateRouteUnit: function (result) {
      var routeUnitVal;
      if (this.config.routeUnitsRoundingOption === this.config.settingNLS
        .oneDecimalValue) {
        routeUnitVal = result.toFixed(1);
      } else if (this.config.routeUnitsRoundingOption === this.config.settingNLS
        .twoDecimalValue) {
        routeUnitVal = result.toFixed(2);
      } else if (this.config.routeUnitsRoundingOption === this.config
        .settingNLS.noDecimalValue) {
        routeUnitVal = result.toFixed();
      } else if (this.config.routeUnitsRoundingOption === this.config
        .settingNLS.tenDecimalValue || this.config.routeUnitsRoundingOption ===
        this.config.settingNLS.hunderedDecimalValue || this.config.routeUnitsRoundingOption ===
        this.config.settingNLS.thousandDecimalValue) {
        routeUnitVal = Math.round(result / parseInt(this.config.routeUnitsRoundingOption,
          10)) * parseInt(this.config.routeUnitsRoundingOption, 10);
      }
      return routeUnitVal;
    },

    /**
    * This function will draw the closest route path and show it on map
    * @params{object}routes: object containing the information of closest route
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    getLengthOfGeometry: function (geometry, lengthUnit) {
      var length, simplifiedGeometry;
      length = 0;
      if (geometry.spatialReference) {
        //Used to get unit of feature, but not needed as if omited, geometry unit is returned
        //if (lengthUnit == null)
        //{
        //  lengthUnit = scaleUtils.getUnitValueForSR(geometry.spatialReference);
        // }
        simplifiedGeometry = geometryEngine.simplify(geometry);
        if (simplifiedGeometry) {
          //Check if feature's SpatialReference is webMercator or non-webMercator
          //to calculate length either in geodesic or planar respectively
          if (geometry.spatialReference.isWebMercator() || geometry.spatialReference
            .wkid === 4326) {
            length = geometryEngine.geodesicLength(simplifiedGeometry, lengthUnit);
          } else {
            length = geometryEngine.planarLength(simplifiedGeometry, lengthUnit);
          }
        }
        return length;
      }
      else {
        return null;
      }
    },
    _showFinalRoute: function (routes) {
      var lineSymbol, finalRoute, pathLine, routeSymbolData,
        routeUnitVal,
        routeLayerInfos = [],
        routeFieldInfo = [],
        variable, resultVariable, result, routeGeometry;
      var lengthUnit = null;
      if (this.config && this.config.routeLengthEsriUnits && this.config.routeLengthEsriUnits != -1) {
        lengthUnit = this.config.routeLengthEsriUnits
      }
      this._routeLength = this.getLengthOfGeometry(routes.geometry, lengthUnit);
      if (this._routeLength === null) {
        this._routeLength = routes.attributes.Shape_Length;
      }
      this._routeLength = this._calculateRouteUnit(this._routeLength);
      variable = this._routeLength;
      if (this.config && this.config.LabelForBox) {
        this.lblForBox.innerHTML = this.config.LabelForBox;
      }
      if (this.config && this.config.ExpressionValue) {
        resultVariable = this._getStringValue(variable);
        result = eval(resultVariable); // jshint ignore:line
        routeUnitVal = this._calculateRouteUnit(result);
        if (this.config.Before) {
          this.routeLengthCountValue.innerHTML = this.config.routeLengthLabelUnits +
            " " + routeUnitVal;
        } else {
          this.routeLengthCountValue.innerHTML = routeUnitVal +
            " " + this.config.routeLengthLabelUnits;
        }
        this._routeCost = routeUnitVal;
      }
      
      if (this.config && this.config.symbol && this.config.symbol.length &&
        this.config.symbol.length > 0) {
        routeSymbolData = this._getSymbolJson("routeSymbol");
        lineSymbol = this._createGraphicFromJSON(routeSymbolData);
        //finalRoute = new Graphic(pathLine, lineSymbol);
        pathLine = new Geometry.Polyline(this.map.spatialReference);
        if (routes.geometry && routes.geometry.paths && routes.geometry
          .paths.length > 0) {
          pathLine.addPath(routes.geometry.paths[0]);
          finalRoute = new Graphic(pathLine, lineSymbol);
          finalRoute.attributes = {};
          finalRoute.attributes[this.routeFeatureLayer.objectIdField] =
            "1";
          // clear the route graphic layer before adding new graphic
          if (this.routeFeatureLayer) {
            if (this.routeFeatureLayer.graphics && this.routeFeatureLayer
              .graphics.length > 0) {
              this.map.getLayer("routeFeatureLayer").clear();
            }
            this.routeFeatureLayer.add(finalRoute);
            this.attInspector = null;
            domConstruct.empty(this.editableFieldContainer);
            routeFieldInfo = this.layerFieldsToFieldInfos();
            routeLayerInfos = [{
              'featureLayer': this.routeFeatureLayer,
              'showAttachments': false,
              'isEditable': true,
              'fieldInfos': routeFieldInfo
            }];
            this.attInspector = new AttributeInspector({
              layerInfos: routeLayerInfos
            }, domConstruct.create("div", {}, this.editableFieldContainer));
            this.attInspector.startup();
            on(this.attInspector, "attribute-change", lang.hitch(this,
              function (evt) {
                if (this.routeFeatureLayer && this.routeFeatureLayer
                  .graphics && this.routeFeatureLayer.graphics.length >
                  0) {
                  if (evt.fieldName === this.config.FieldMappingData
                    .routeLayerField) {
                    this._changeInField = true;
                  }
                  if (evt.fieldValue !== null && evt.fieldValue !==
                    undefined && (evt.fieldValue === "NaN" || evt
                      .fieldValue.toString() !== "NaN")) {
                    this.routeFeatureLayer.graphics[0].attributes[
                      evt.fieldName] = evt.fieldValue;
                  } else if (evt.fieldValue !== undefined) {
                    this.routeFeatureLayer.graphics[0].attributes[
                      evt.fieldName] = null;
                  }
                }
              }));
          }
          if (this.config.AllowBusinessOptional) {
            // Call function to draw buffer around the closest route path
            this._createBufferGeometry([routes.geometry], [this.config
                .bufferDistance
              ],
              this.config.bufferEsriUnits, [this.map.extent.spatialReference
                .wkid
              ]);
          } else {
            if (this.clearButtonSearch) {
              this.clearButtonSearch.disabled = false;
              domClass.remove(this.clearButtonSearch,
                "jimu-state-disabled");
            }
            routeGeometry = routes.geometry;
            this.map.setExtent(routeGeometry.getExtent(), true);
            if (this.ExportToLayer) {
              domStyle.set(this.ExportToLayer, "display",
                "inline-block");
            }
            this._setRouteAttributes();
            this.isResultExist = true;
            this._switchToResultPanel();
            this._enableAllControls();
          }
        } else {
          this.errorExist = true;
          this._onClearButtonClicked(false);
          this._enableAllControls();
          this._showAlertMessage(this.nls.unableToGenerateRoute);
          this._hideLoadingIndicator();
        }
      }
    },

    /**
    * This function will show the loading indicator
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    showLoadingIndicator: function () {
      this.loading.placeAt(this.domNode);
      this.loading.show();
    },

    /**
    * This function will set the feature layer according to the selected option in find nearest dropdown
    * @params{object}value: object containing the value of selected option of dropdown
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setLayerForDropdown: function (value) {
      var j;
      // loop to get the business layer and find nearest dropdown layer url into variable
      for (j = 0; j < this.map.itemInfo.itemData.operationalLayers.length; j++) {
        if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          value) {
          this.layer = this.map.itemInfo.itemData.operationalLayers[j]
            .url;
          if (this.map.itemInfo.itemData.operationalLayers[j].layerDefinition &&
            this.map.itemInfo.itemData.operationalLayers[j].layerDefinition
            .definitionExpression &&
            this.map.itemInfo.itemData.operationalLayers[j].layerDefinition
            .definitionExpression !== "" &&
            this.map.itemInfo.itemData.operationalLayers[j].layerDefinition
            .definitionExpression !== null) {
            this._existingDefinitionExpression = this.map.itemInfo.itemData
              .operationalLayers[j].layerDefinition.definitionExpression;
          } else {
            this._existingDefinitionExpression = null;
          }
        }
        if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          this.config.businessesLayerName) {
          this.businessLayer = this.map.itemInfo.itemData.operationalLayers[
            j];
        }
        if (this.config && this.config.targetRouteLayer) {
          if (this.map.itemInfo.itemData.operationalLayers[j].title ===
            this.config.targetRouteLayer) {
            this.routeLayer = this.map.itemInfo.itemData.operationalLayers[
              j];
          }
        }
      }
    },

    /**
    * This function check layer availability in the map object
    * @params{string}layerTitle: layer title
    * @return{boolean} : flag that indicates whether layer is available
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _checkLayerAvailability: function (layerTitle) {
      var isLayerAvailable = false,
        j;
      for (j = 0; j < this.map.itemInfo.itemData.operationalLayers.length; j++) {
        if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          layerTitle) {
          isLayerAvailable = true;
          break;
        }
      }
      return isLayerAvailable;
    },

    /**
    * This function check whether a layer is editable
    * @params{string}layerTitle: layer title
    * @return{boolean} : flag that indicates whether layer is editable
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _validateEditCapabilities: function (layerTitle) {
      var layerCapabilities, isLayerEditable = false,
        j;
      for (j = 0; j < this.map.itemInfo.itemData.operationalLayers.length; j++) {
        if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          layerTitle) {
          layerCapabilities = this.map.itemInfo.itemData.operationalLayers[
            j].resourceInfo.capabilities;
          // if layer has capability of create & update than return true
          if (layerCapabilities && layerCapabilities.indexOf("Create") >
            -1 && layerCapabilities.indexOf("Update") > -1) {
            isLayerEditable = true;
          } else if (layerCapabilities && layerCapabilities.indexOf(
              "Create") > -1 && layerCapabilities.indexOf("Editing") >
            -1) {
            // if layer has capability of create & editing than return true
            isLayerEditable = true;
          }
        }
        if (isLayerEditable) {
          break;
        }
      }
      return isLayerEditable;
    },


    /**
    * This function will query for business features lies inside the buffer of closest route and show them on map
    * @params{object}resultGeometry: object containing information of buffer geometry
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _queryForBusinessData: function (resultGeometry) {
      var businessQuery, queryLayerTask, dateobj;
      businessQuery = new Query();
      businessQuery.geometry = resultGeometry;
      businessQuery.outSpatialReference = resultGeometry.spatialReference;
      businessQuery.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
      dateobj = new Date().getTime().toString();
      businessQuery.where = dateobj + "=" + dateobj;
      this.businessLayer.layerObject.refresh();
      queryLayerTask = new QueryTask(this.businessLayer.url);
      queryLayerTask.executeForIds(businessQuery, lang.hitch(this,
        function (queryResult) {
          this._validateResultCount(queryResult);
          this._showBusinessDataOnMap(queryResult);
        }), lang.hitch(this, function (err) {
          this.errorExist = true;
          this._onClearButtonClicked(false);
          this._showAlertMessage(err.message);
          this._enableAllControls();
        }));
    },

    /**
    * This function will validate result count whether it is greater than two or not
    * @params{array}queryResult: results list
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _validateResultCount: function (queryResult) {
      if ((queryResult && queryResult.length < 2) || !queryResult) {
        domClass.add(this.sortIconDiv, "esriCTHidePanel");
      } else {
        domClass.remove(this.sortIconDiv, "esriCTHidePanel");
      }
    },

    /**
    * This function will show the business feature graphics on map
    * @param{array}queryResult:array containing the resultant feature ids
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _showBusinessDataOnMap: function (queryResult) {
      // when features length inside buffer is grater than 0 show the features on map else show the empty grid with no features on map
      
      if (queryResult && queryResult.length > 0) {
        this.businessPassedCountValue.innerHTML = queryResult.length;
        this._businessPassed = queryResult.length;
        this.isResultExist = true;
        if (this.config.businessesLayerName !== this.config.targetBusinessLayer) {
          this.businessLayer.layerObject.setDefinitionExpression(
            "OBJECTID IN (" + queryResult + ")");
        }
        this.businessLayer.layerObject.show();
        this._changeInField = false;
        this.businessLayer.layerObject.refresh();
        this._queryForObjectIds(queryResult);
        this._enableAllControls();
        this._setRouteAttributes();
      } else {
        this.isResultExist = true;
        domConstruct.empty(this.resultListContainer);
        if (!queryResult) {
          this.businessPassedCountValue.innerHTML = 0;
        } else {
          this.businessPassedCountValue.innerHTML = queryResult.length;
        }
        domConstruct.create("div", {
          "innerHTML": this.nls.noBusinessPassedMsg,
          "class": "esriCTDefaultCursor"
        }, this.resultListContainer);
        domClass.add(this.resultListContainer.childNodes[0],
          "esriCTDefaultCursor");
        if (this.ExportToLayer) {
          domStyle.set(this.ExportToLayer, "display", "inline-block");
          //domStyle.set(this.ExportToLayer, "display", "none");
        }
        this.resultListContainer.disabled = true;
        this._switchToResultPanel();
        this._enableAllControls();
        domClass.remove(this.businessPassedResultListLabel,
          "esriCTListLabelCSV");
        domClass.remove(this.businessPassedResultListLabel,
          "esriCTListLabelArrow");
        domClass.add(this.businessPassedResultListLabel,
          "esriCTListLabelFullWidth");
        this._setRouteAttributes();
      }
    },

    /**
    * This function will set route attributes
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setRouteAttributes: function () {
      if (this.routeFeatureLayer && this.routeFeatureLayer.graphics.length >
        0) {
        if (this.config.saveRoutelengthField && lang.trim(this.config
            .saveRoutelengthField) !== "") {
          this.routeFeatureLayer.graphics[0].attributes[this.config.saveRoutelengthField] =
            this._routeLength;
        }
        if (this.config.saveBusinessCountField && lang.trim(this.config
            .saveBusinessCountField) !== "") {
          this.routeFeatureLayer.graphics[0].attributes[this.config.saveBusinessCountField] =
            this._businessPassed;
        }
        if (this.config.saveRouteCostField && lang.trim(this.config
            .saveRouteCostField) !== "") {
          this.routeFeatureLayer.graphics[0].attributes[this.config.saveRouteCostField] =
            this._routeCost;
        }
      }
    },

    /**
    * This function change the panel to show results
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _switchToResultPanel: function () {
      var j;
      for (j = 0; j < this.tabContainer.controlNodes.length; j++) {
        // when result exists then show the result panel else show search panel
        if (this.isResultExist) {
          if (this.tabContainer.controlNodes[j].innerHTML === this.nls
            .resultsContainerHeading) {
            domClass.remove(this.tabContainer.controlNodes[j],
              "jimu-tab>.control>.tab.jimu-state-selected+.tab");
            domClass.replace(this.tabContainer.controlNodes[j],
              "tab jimu-vcenter-text jimu-state-selected",
              "tab jimu-vcenter-text");
            domStyle.set(this.tabContainer.tabs[j].content, "display",
              "block");
            domStyle.set(this.resultContainer, "display", "block");
            if (this.config.AllowBusinessOptional) {
              domStyle.set(this.resultListContainer, "display",
                "block");
              domStyle.set(this.businessTitleContainer, "display",
                "block");
            } else {
              domClass.add(this.businessPassedDiv,
                "esriCTHideBusinessPassedDiv");
              domClass.add(this.costHeadingDiv,
                "esriCTCostHeadingDivFullWidth");
              domStyle.set(this.resultListContainer, "display",
                "none");
              domStyle.set(this.businessTitleContainer, "display",
                "none");
            }
            domClass.remove(this.divExportToLayerButtons,
              "esriCTHidePanel");
            if (this._businessPassed == 0) {
              domStyle.set(this.businessLayerChkbox, "display",
                "none");
            }
            else {
              domStyle.set(this.businessLayerChkbox, "display",
                "block");

            }
          } else if (this.tabContainer.controlNodes[j].innerHTML ===
            this.nls.searchContainerHeading) {
            domClass.replace(this.tabContainer.controlNodes[j],
              "tab jimu-vcenter-text",
              "tab jimu-vcenter-text jimu-state-selected");
            domStyle.set(this.tabContainer.tabs[j].content, "display",
              "none");
            domStyle.set(this.tabSearch, "display", "none");
          }
        } else if (this.tabContainer.controlNodes[j].innerHTML ===
          this.nls.resultsContainerHeading && !this.saveLayerClicked) {
          domStyle.set(this.resultContainer, "display", "none");
          domStyle.set(this.resultListContainer, "display", "none");
          domStyle.set(this.businessTitleContainer, "display", "none");
          domClass.add(this.divExportToLayerButtons,
            "esriCTHidePanel");
          domClass.add(this.tabContainer.controlNodes[j],
            "changeForResultContainer");
        } else if (this.saveLayerClicked) {
          domStyle.set(this.tabContainer.controlNodes[j], "display",
            "none");
        }
      }
      this._hideLoadingIndicator();
    },

    /**
    * This function will disable all the controls of search & result panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _disableAllControls: function () {
      this.findButton.disabled = true;
      domClass.add(this.findButton, "jimu-state-disabled");
      domClass.replace(this.imgSelectLocationDojo,
        "esriCTimgSelectLocation", "esriCTImgLocationSelected");
      domClass.replace(this.pointImageContainer, "esriCTImgPoint",
        "esriCTImgPointSelected");
      domClass.replace(this.polylineImageContainer,
        "esriCTImgPolyline", "esriCTImgPolylineSelected");
      domClass.replace(this.polygonImageContainer, "esriCTImgPolygon",
        "esriCTImgPolygonSelected");
      domClass.add(this.clearButtonSearch, "jimu-state-disabled");
      this.toolbar.deactivate();
      this.clearButtonSearch.disabled = true;
      domConstruct.empty(this.resultListContainer);
      this.isClearClicked = false;
      this._businessDataSaved = false;
      this._routeDataSaved = false;
    },

    /**
    * This function will enable all the controls of search panel once run analysis is completed
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _enableAllControls: function () {
      var numberSliderNode, numberTextbox, numberSliderbox,
        resettxtbox;
      if (this.barrierGraphicLayer.graphics.length > 0 || this.selectLocationGraphicLayer
        .graphics.length > 0 || this.routeFeatureLayer.graphics.length >
        0 || this.map.getLayer("bufferGraphicLayer").length > 0) {
        domClass.remove(this.clearButtonSearch, "jimu-state-disabled");
        this.clearButtonSearch.disabled = false;
      }
      this.selectLocationClicked = false;
      numberSliderNode = query(".esriCTBusinessInfluenceSlider");
      // loop for traversing all the sliders in result panel and enabling once run analysis completed
      array.forEach(numberSliderNode, lang.hitch(this, function (
        sliderNode) {
        // if sliderNode parent node found then only
        if (sliderNode) {
          numberSliderbox = query(".dijitSlider", sliderNode);
          // if sliderNode node found inside sliderNode parent node then enable it
          if (numberSliderbox) {
            dijit.byId(numberSliderbox[0].id).disabled = false;
          }
        }
      }));

      resettxtbox = query(".esriCTTxtboxParamValue");
      array.forEach(resettxtbox, lang.hitch(this, function (inputNode) {
        // if inputNode parent node found then only
        if (inputNode) {
          numberTextbox = query(".dijitReset .dijitInputInner",
            inputNode);
          // if inputNode node found inside inputNode parent node then disable it
          if (numberTextbox) {
            dijit.byId(numberTextbox[0].id).disabled = false;
          }
        }
      }));

      this.selectFindNearest.disabled = false;
    },

    /**
    * This function will query for all the business feature attributes lies within the buffer area
    * @params{array}batchIds: array containing the ids of the businesses passed features
    * @return{object}queryObjectDeferred: promise object of the request
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _queryForGridFeatures: function (batchIds) {
      var dateobj, queryObjectTask, queryObjectDeferred,
        businessResultQuery;
      queryObjectDeferred = new Deferred();
      businessResultQuery = new Query();
      dateobj = new Date().getTime().toString();
      businessResultQuery.outFields = ["*"];
      businessResultQuery.objectIds = batchIds;
      businessResultQuery.returnGeometry = true;
      businessResultQuery.outSpatialReference = this.map.spatialReference;
      businessResultQuery.where = dateobj + "=" + dateobj;
      queryObjectTask = new QueryTask(this.businessLayer.url);
      queryObjectTask.execute(businessResultQuery, lang.hitch(this,
        function (result) {
          queryObjectDeferred.resolve(result);
        }), lang.hitch(this, function (err) {
          queryObjectDeferred.resolve();
          this.errorExist = true;
          this._onClearButtonClicked(false);
          this._showAlertMessage(err.message);
          this._hideLoadingIndicator();
        }));
      return queryObjectDeferred;
    },

    /**
    * This function will handle the deferred promise returned from _queryForGridFeatures function containing result for each feature lies in the buffer
    * @params{array}businessIds: array containing the ids of the businesses passed features
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _queryForObjectIds: function (businessIds) {
      var batchIds = [],
        batch, startIdx, endIdx, deferredArray = [],
        i;
      this.resultDisplayAttributes = [];
      this.results = [];
      this.resultDisplayField = [];
      this.businessGraphicArray = [];
      this.results.length = 0;
      if (businessIds !== null) {
        batch = Math.ceil(businessIds.length / 1000);
        for (i = 1; i < batch + 2; i++) {
          batchIds = [];
          startIdx = 0;
          endIdx = 0;
          if (i !== batch) {
            endIdx = (i * 1000);
            startIdx = endIdx - 1000;
          } else {
            endIdx = businessIds.length;
            startIdx = (i - 1) * 1000;
          }
          batchIds = businessIds.slice(startIdx, endIdx);
          deferredArray.push(this._queryForGridFeatures(batchIds));
          if (endIdx === businessIds.length) {
            break;
          }
        }
        all(deferredArray).then(lang.hitch(this, function (result) {
          this._setContentForResultGrid(result);
        }));
      }
    },

    /**
    * This function will push the result features in arrays to further create result ggrid
    * @params{array}result: array containing the ids of the businesses passed features
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setContentForResultGrid: function (result) {
      var l, j;
      // loop to get the attributes of each feature for the given field in config and push it in array
      if (result) {
        for (j = 0; j < result.length; j++) {
          if (this.results.length === 0) {
            this.results = result[j].features;
          } else {
            this.results.concat(result[j].features);
          }
        }
        this.resultDisplayAttributes.length = 0;
        this.resultDisplayField.length = 0;
        for (l = 0; l < this.results.length; l++) {
          if (this.results[l].attributes.hasOwnProperty(
              this.config.businessDisplayField)) {
            this.resultDisplayAttributes.push(this.results[l]);
            this.resultDisplayField.push({
              "name": this.results[l].attributes[
                this.config.businessDisplayField],
              "objectId": this.results[l].attributes[this.businessLayer
                .layerObject.fields[0].name]
            });
          }
        }
        this.businessGraphicArray = lang.clone(this.resultDisplayAttributes);
      }
      if (this.results.length > 0) {
        this._businesspassedAscOrder();
        domStyle.set(this.exportToCSVContainer, "display", "block");
        if (this.ExportToLayer) {
          domStyle.set(this.ExportToLayer, "display", "inline-block");
        }
      } else {
        domClass.add(this.sortIconDiv, "esriCTHidePanel");
        domStyle.set(this.exportToCSVContainer, "display", "none");
        if (this.ExportToLayer) {
          domStyle.set(this.ExportToLayer, "display", "inline-block");
          //domStyle.set(this.ExportToLayer, "display", "none");
        }
      }
    },

    /**
    * This function is used to display the Bussiness passed list in ascending order
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _businesspassedAscOrder: function () {
      domConstruct.empty(this.resultListContainer);
      if (this.config.businessDisplayField && this.resultDisplayAttributes
        .length > 0) {
        this.resultDisplayAttributes = this.resultDisplayAttributes.sort(
          lang.hitch(this, function (a, b) {
            return (a.attributes[this.config.businessDisplayField] <
                b.attributes[this.config.businessDisplayField]) ?
              -1 : (a.attributes[this.config.businessDisplayField] >
                b.attributes[this.config.businessDisplayField]) ?
              1 : 0;
          }));
        this.resultDisplayField = this.resultDisplayField.sort(
          function (a, b) {
            return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 :
              0;
          });
      }
      this._createResultGrid(this.resultDisplayField, this.resultDisplayAttributes);
    },

    /**
    * This function is used to display the Bussiness passed list in descending order
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _businesspassedDescOrder: function () {
      domConstruct.empty(this.resultListContainer);
      if (this.config.businessDisplayField && this.resultDisplayAttributes
        .length > 0) {
        this.resultDisplayAttributes = this.resultDisplayAttributes.sort(
          lang.hitch(this, function (a, b) {
            return (a.attributes[this.config.businessDisplayField] >
                b.attributes[this.config.businessDisplayField]) ?
              -1 : (a.attributes[this.config.businessDisplayField] <
                b.attributes[this.config.businessDisplayField]) ?
              1 : 0;
          }));
        this.resultDisplayField = this.resultDisplayField.sort(
          function (a, b) {
            return (a.name > b.name) ? -1 : (a.name < b.name) ? 1 :
              0;
          });
      }
      this._createResultGrid(this.resultDisplayField, this.resultDisplayAttributes);
    },

    /**
    * This function will create the grid for diplaying results of businesses passed
    * @params{Array}displayList: array containing the field text to be displayed on grid
    * @params{Array}resultFeatures: array containing the geometry and attributes of the features lies within buffer
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createResultGrid: function (displayList, resultFeatures) {
      var m, exportToCSV, list, saveExportDiv;
      domConstruct.empty(this.exportToCSVContainer);

      saveExportDiv = domConstruct.create("div", {
        "class": "esriCTSaveExportBtnDiv"
      }, this.exportToCSVContainer);

      if (this.config.exportToCSV) {
        exportToCSV = domConstruct.create("div", {
          "class": "esriCTexportCsvBtn",
          "title": this.nls.exportToCSVTitle
        }, saveExportDiv);
        on(exportToCSV, "click", lang.hitch(this, function () {
          this._createCSVContent();
        }));
      }

      if (!window.appInfo.isRunInMobile) {
        this._setHeightOfResultListContainer();
      }

      // loop to create result grid for each feature and binding the events
      for (m = 0; m < displayList.length; m++) {
        list = domConstruct.create("div", {
          "class": "esriCTFeatureFieldContainer",
          "innerHTML": displayList[m].name,
          "id": displayList[m].objectId
        }, this.resultListContainer);
        this._attachEventsToResultListContainer(resultFeatures, list);
      }

      this.isResultExist = true;
      this._switchToResultPanel();
    },

    /**
    * This function is used to set height of result list container
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setHeightOfResultListContainer: function () {
      var parentContainerHeight, tabHeight, labelContainerHeight,
        listTitleHeight, clearButtonContainerHeight, parentContainer,
        tabs, computedResultListHeight, resizeHandle,
        resizeHandleHeight, additionalPixel;

      parentContainer = query(".jimu-widget-frame.jimu-container");
      if ((parentContainer && parentContainer.length === 0) || (!
          parentContainer)) {
        parentContainer = query(".jimu-container");
      }
      if (parentContainer && parentContainer.length > 0) {
        parentContainerHeight = domStyle.getComputedStyle(
          parentContainer[0]).height;
        parentContainerHeight = parentContainerHeight.replace(/px/g,
          '');
        if (parentContainerHeight !== "auto") {
          parentContainerHeight = parseFloat(parentContainerHeight);
        } else {
          parentContainerHeight = 0;
        }
      } else {
        parentContainerHeight = 0;
      }

      tabs = query(".tab.jimu-vcenter-text");
      if (tabs && tabs.length > 0) {
        tabHeight = domStyle.getComputedStyle(tabs[0]).height;
        tabHeight = tabHeight.replace(/px/g, '');
        if (tabHeight !== "auto") {
          tabHeight = parseFloat(tabHeight);
        } else {
          tabHeight = 0;
        }
      } else {
        tabHeight = 0;
      }

      labelContainerHeight = domStyle.getComputedStyle(this.resultContainer)
        .height;
      labelContainerHeight = labelContainerHeight.replace(/px/g, '');
      if (labelContainerHeight !== "auto") {
        labelContainerHeight = parseFloat(labelContainerHeight);
      } else {
        labelContainerHeight = 0;
      }

      listTitleHeight = domStyle.getComputedStyle(this.selectionListTitleContainer)
        .height;
      listTitleHeight = listTitleHeight.replace(/px/g, '');
      if (listTitleHeight !== "auto") {
        listTitleHeight = parseFloat(listTitleHeight);
      } else {
        listTitleHeight = 0;
      }

      clearButtonContainerHeight = domStyle.getComputedStyle(this.clearButtonSearch)
        .height;
      clearButtonContainerHeight = clearButtonContainerHeight.replace(
        /px/g, '');
      if (clearButtonContainerHeight !== "auto") {
        clearButtonContainerHeight = parseFloat(
          clearButtonContainerHeight);
      } else {
        clearButtonContainerHeight = 0;
      }

      resizeHandle = query(".dojoxResizeHandle.dojoxResizeNW");

      if (resizeHandle && resizeHandle.length > 0) {
        resizeHandleHeight = domStyle.getComputedStyle(
          resizeHandle[0]).height;
        resizeHandleHeight = resizeHandleHeight.replace(
          /px/g, '');
        if (resizeHandleHeight !== "auto") {
          resizeHandleHeight = parseFloat(
            resizeHandleHeight);
        } else {
          resizeHandleHeight = 0;
        }
      } else {
        resizeHandleHeight = 0;
      }

      if (this.appConfig.theme.name === "DartTheme" && has("ie") ===
        9) {
        additionalPixel = 62;
      } else if (this.appConfig.theme.name === "LaunchpadTheme" &&
        has("ie")) {
        additionalPixel = 70;
      } else if (this.appConfig.theme.name === "LaunchpadTheme" &&
        document && document.documentMode) {
        additionalPixel = 70;
      } else if (this.appConfig.theme.name === "BillboardTheme") {
        additionalPixel = 70;
      } else {
        additionalPixel = 55;
      }

      computedResultListHeight = parentContainerHeight - (
        labelContainerHeight + listTitleHeight +
        clearButtonContainerHeight + tabHeight +
        resizeHandleHeight + additionalPixel);

      computedResultListHeight = computedResultListHeight + "px";

      domStyle.set(this.resultListContainer, "max-height",
        computedResultListHeight);
    },

    /**
    * This function is used to resize the business list on resize of panel
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    resize: function () {
      if (!window.appInfo.isRunInMobile) {
        this._setHeightOfResultListContainer();
      }
    },

    /**
    * This function will bind the events for each result in the business passed grid
    * @params{Array}resultFeatures: array containing the geometry and attributes of the features lies within buffer
    * @params{object}list: object containing displayed information about feature
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _attachEventsToResultListContainer: function (resultFeatures, list) {
      var i, selectedFeature, featureId,
        featureList = [];
      this.own(on(list, "click", lang.hitch(this, function (evt) {
        selectedFeature = lang.trim(evt.target.innerHTML.replace(
          "amp;", ""));
        featureId = list.id;
        featureList = query(".esriCTFeatureFieldContainer");
        if (featureList && featureList.length > 0) {
          for (i = 0; i < featureList.length; i++) {
            domClass.remove(featureList[i],
              "esriCTSelectedFeatureFieldList");
            domClass.remove(featureList[i],
              "esriCTSelectedDartFeatureFieldList");
            domClass.remove(featureList[i],
              "esriCTHoverFeatureList");
            domClass.remove(featureList[i],
              "esriCTDartHoverFeatureList");
          }
        }
        if (this.appConfig.theme.name !== "DartTheme") {
          domClass.add(evt.target,
            "esriCTSelectedFeatureFieldList");
        } else {
          domClass.add(evt.target,
            "esriCTSelectedDartFeatureFieldList");
        }
        this._highlightFeatureOnMap(selectedFeature,
          resultFeatures, featureId);
      })));
      this.own(on(list, "mouseover", lang.hitch(this, function (evt) {
        if (evt.target.childNodes.length < 2 && evt.target.innerHTML !==
          this.nls.noBusinessPassedMsg && this.appConfig.theme
          .name !== "DartTheme") {
          domClass.add(evt.target,
            "esriCTHoverFeatureList");
        } else {
          domClass.add(evt.target,
            "esriCTDartHoverFeatureList");
        }
      })));
      this.own(on(list, "mouseout", lang.hitch(this, function (evt) {
        if (evt.target.childNodes.length < 2 && !domClass.contains(
            evt.target, "esriCTSelectedFeatureFieldList") &&
          this.appConfig.theme.name !== "DartTheme") {
          domClass.remove(evt.target,
            "esriCTHoverFeatureList");
        } else {
          domClass.remove(evt.target,
            "esriCTDartHoverFeatureList");
        }
      })));
    },

    /**
    * This function will highlight the selected feature from the grid and show it on map
    * @params{object}selectedFeature: object containing the selected feature text from the result grid
    * @params{Array}resultFeatures: array containing the geometry and attributes of the features lies within buffer
    * @params{object}featureId: object containing the selected feature id
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _highlightFeatureOnMap: function (selectedFeature, resultFeatures,
      featureId) {
      var m, rippleGraphic, featureGeometry, featureDisplayField;
      for (m = 0; m < resultFeatures.length; m++) {
        featureDisplayField = resultFeatures[m].attributes[this.config
          .businessDisplayField];
        if (featureDisplayField !== null && featureDisplayField !==
          undefined && featureDisplayField !== "") {
          if ((resultFeatures[m].attributes[this.config.businessDisplayField]
              .toString()) === selectedFeature && (resultFeatures[m].attributes[
              this.businessLayer.layerObject.fields[0].name].toString()) ===
            featureId) {
            this.highlightGraphicLayer.clear();
            if (resultFeatures[m].geometry.type === "polyline") {
              featureGeometry = this._getLineCenter(resultFeatures[m]
                .geometry);
            } else if (resultFeatures[m].geometry.type === "polygon") {
              featureGeometry = this._getPolygonCentroid(
                resultFeatures[m].geometry);
            } else if (resultFeatures[m].geometry.type === "point") {
              featureGeometry = resultFeatures[m].geometry;
            }
            if (featureGeometry) {
              rippleGraphic = new Graphic(featureGeometry, null, null,
                null);
              this.highlightGraphicLayer.add(rippleGraphic);
              this.map.centerAt(featureGeometry);
            }
            this.timer.stop();
            this.timer.start();
          }
        }
      }
    },

    /**
    * This function will create the content to export in format of CSV
    *  @return{object}deferred: promise object of the request
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createCSVContent: function () {
      var i, fieldAttributes = [],
        csvNewLineChar, fieldName = [],
        dateFields = [],
        csvContent;
      try {
        this.showLoadingIndicator();
        setTimeout(lang.hitch(this, function () {
          var key, resultField;
          csvNewLineChar = "\r\n";
          if (this.resultDisplayAttributes.length > 0) {
            if (this.businessLayer && this.businessLayer.layerObject &&
              this.businessLayer.layerObject.fields) {
              for (key in this.resultDisplayAttributes[0].attributes) {
                if (this.resultDisplayAttributes[0].attributes.hasOwnProperty(
                    key)) {
                  for (i = 0; i < this.businessLayer.layerObject
                    .fields.length; i++) {
                    resultField = this.businessLayer.layerObject
                      .fields[i];
                    if (resultField.name === key) {
                      fieldName.push(resultField.alias);
                      if (resultField.type ===
                        "esriFieldTypeDate") {
                        dateFields.push(resultField.name);
                      }
                    }
                  }
                }
              }
            }

            csvContent = fieldName.join(",") + csvNewLineChar;
            for (i = 0; i < this.resultDisplayAttributes.length; i++) {
              fieldAttributes = this._addFieldAttributesValue(i,
                dateFields);
              csvContent += fieldAttributes.join(",") +
                csvNewLineChar;
            }
          }
          this._onExportToCsvComplete(this.businessLayer.title,
            csvContent);
        }, 1000));

      } catch (error) {
        this._showAlertMessage(error.message);
        this._hideLoadingIndicator();
      }
    },

    /**
    * This function will create the content to export in format of CSV
    * @params{object}i: index for each attribute name
    *  @return{array}fieldAttributes: array containing field attribute values
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addFieldAttributesValue: function (i, dateFields) {
      var fieldAttributes = [],
        value, textField = '"';
      array.forEach(this.businessLayer.layerObject.fields, lang.hitch(
        this,
        function (field) {
          if (this.resultDisplayAttributes[i].attributes.hasOwnProperty(
              field.name)) {
            value = this.resultDisplayAttributes[i].attributes[
              field.name];
            if (array.indexOf(dateFields, field.name) > -1) {
              value = this._formatDate(value);
            } else {
              if (!value && typeof value !== "number") {
                value = "";
              }
              if (value && /[",]/g.test(value)) {
                value = textField + value.replace(/(")/g, '""') +
                  textField;
              }
            }
            if (typeof value !== "number") {
              value = value.replace(/(\r\n|\n|\r)/gm, "");
            }
            fieldAttributes.push(value);
          }
        }));
      return fieldAttributes;
    },

    /**
    * This function will locale format the date
    * @params{object}i: index for each attribute name
    * @return{array}fieldAttributes: array containing field attribute values
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _formatDate: function (value) {
      var inputDate, formattedDate;
      if (value !== "" && value !== null) {
        if (!isNaN(value) && Number(value) < 0) {
          inputDate = new Date(0);
          inputDate.setUTCSeconds(value / 1000);
        } else {
          inputDate = new Date(value);
        }
        formattedDate = dateLocale.format(inputDate, {
          datePattern: "yyyy-MM-dd",
          selector: "date"
        });
        return formattedDate;
      }
      value = "";
      return value;
    },

    /**
    * This function will check the browsers and accordingly download the csv file on client side.
    * @params{object}layerName: Name of the layer to export
    * @params{object}csvData: data to be export
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onExportToCsvComplete: function (layerName, csvData) {
      var link, oWin, click_ev;
      if (this.IsIE) {
        oWin = window.open("");
        oWin.document.write(csvData);
        oWin.document.close();
        oWin.document.execCommand('SaveAs', true, layerName);
        oWin.close();
      } else {
        link = domConstruct.create("a", {
          href: 'data:attachment/csv;charset=utf-8,' +
            encodeURIComponent(csvData),
          target: '_blank',
          download: layerName + ".csv"
        }, this.domNode);
        if (this.IsSafari) {
          click_ev = document.createEvent("MouseEvents");
          click_ev.initEvent("click", true, true);
          link.dispatchEvent(click_ev);
        } else {
          link.click();
        }
        domConstruct.destroy(link);
      }
      this._hideLoadingIndicator();
    },

    /**
    * This function is used to create content for "Save to Layer" panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onSaveToLayerClick: function () {
      var saveLayerBackBtn, checkQuery;
      this.checkedLayers = [];
      this._setDisplayForPanels();
      checkQuery = query(".clearInstance");
      if (checkQuery) {
        checkQuery.forEach(domConstruct.destroy);
      }
      this._emptyControls();
      saveLayerBackBtn = domConstruct.create("div", {
        "class": "esriCTBackButtonLabel",
        "innerHTML": this.nls.backButtonLabel
      }, this.saveLayerTitleContainer);
      domConstruct.create("div", {
        "class": "esriCTSaveLayerLabel",
        "innerHTML": this.nls.saveToLayerLabel
      }, this.saveLayerTitleContainer);

      on(saveLayerBackBtn, "click", lang.hitch(this, function () {
        this.saveLayerClicked = false;
        this._setDisplayForPanels();
      }));
      if (this.config && this.config.targetRouteLayer && this.routeFeatureLayer &&
        this.routeFeatureLayer.graphics.length > 0 && this.routeFeatureLayer
        .objectIdField && this.routeFeatureLayer.objectIdField !== ""
      ) {
        this._createRouteLayerCheck();
        domStyle.set(this.routeLayerContaineDiv, "display", "block");
      } else {
        domStyle.set(this.routeLayerContaineDiv, "display", "none");
      }
      this._createBussinessLayerContainer();
      this._createSaveToLayerBtn();
    },

    /**
    * This functiuon will create Business Layer check box in Save To layer panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createBussinessLayerContainer: function () {
      var bussinessLayerDiv, bussinessContainer;
      // check whether business layer which is to be saved exists in config
      if (this.config && this.config.targetBusinessLayer) {
        bussinessLayerDiv = domConstruct.create("div", {
          "class": "clearInstance"
        }, this.businessLayerChkbox);
        bussinessContainer = domConstruct.create("div", {
          "class": "clearInstance"
        }, bussinessLayerDiv);
        this.businessLayerChk = new CheckBox({
          "class": "esriCTRouteChkBox clearInstance"
        }, bussinessContainer);
        domConstruct.create("label", {
          "class": "esriCTRouteLayerLabel clearInstance",
          "innerHTML": this.nls.businessLayerLabel
        }, bussinessContainer);
        domAttr.set(this.businessLayerChk.domNode, "title", this.config
          .targetBusinessLayer);
        this._onBusinessLayerCheck(this.businessLayerChk.domNode);
        domStyle.set(this.businessLayerContainerDiv, "display",
          "block");
      } else {
        domStyle.set(this.businessLayerContainerDiv, "display",
          "none");
      }
    },

    /**
    * This function will create "Save" button in Save to Layer panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createSaveToLayerBtn: function () {
      this.saveToLayerBtn = domConstruct.create("div", {
        "class": "esriCTSaveButtonLabel jimu-btn jimu-state-disabled",
        "innerHTML": this.nls.saveBtnLabel
      }, this.saveToLayerBtnContainer);
      this.saveToLayerBtn.disabled = true;
      on(this.saveToLayerBtn, "click", lang.hitch(this, function () {
        if (!this.saveToLayerBtn.disabled) {
          this._onSaveBtnClick();
        }
      }));
      domClass.remove(this.saveToLayerContainer, "esriCTHidePanel");
      this._hideLoadingIndicator();
    },

    /**
    * This function will empty the controls of Save to layer panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _emptyControls: function () {
      domConstruct.empty(this.saveToLayerBtnContainer);
      domConstruct.empty(this.businessLayerChkbox);
      domConstruct.empty(this.routeLayerChkbox);
    },

    /**
    * This function is used to bind the event for route Layer checkBox in "Save to Layer" panel
    * @params{object}checkBox: Checkbox for saving route layer
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onRouteLayerCheck: function (checkbox) {
      on(checkbox, "click", lang.hitch(this, function (event) {
        if (domClass.contains(event.target, "checkbox")) {
          if (domClass.contains(event.target, "checked")) {
            domClass.remove(this.esriCTSaveBusinessRouteLength,
              "esriCTHidePanel");
            domClass.add(event.currentTarget,
              "esriCTSaveCheckbox");
            if (array.indexOf(this.checkedLayers, event.currentTarget) ===
              -1) {
              this.checkedLayers.push(event.currentTarget);
            }
            this.saveToLayerBtn.disabled = false;
            domClass.remove(this.saveToLayerBtn,
              "jimu-state-disabled");
            this._showFieldsToEdit();
          } else {
            domClass.add(this.esriCTSaveBusinessRouteLength,
              "esriCTHidePanel");
            domClass.remove(event.currentTarget,
              "esriCTSaveCheckbox");
            if (array.indexOf(this.checkedLayers, event.currentTarget) !==
              -1) {
              this.checkedLayers.splice(array.indexOf(this.checkedLayers,
                event.currentTarget), 1);
            }
            if (this.checkedLayers.length === 0) {
              this.saveToLayerBtn.disabled = true;
              domClass.add(this.saveToLayerBtn,
                "jimu-state-disabled");
            }
          }
        }
      }));
    },

    /**
    * This function is used create attribute inspector for route layer
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _showFieldsToEdit: function () {
      var selectQuery = new Query();
      if (this.routeFeatureLayer && this.routeFeatureLayer.graphics.length >
        0 && this.routeFeatureLayer.objectIdField && this.routeFeatureLayer
        .objectIdField !== "") {
        selectQuery.objectIds = [this.routeFeatureLayer.graphics[0].attributes[
          this.routeFeatureLayer.objectIdField]];
        this.routeFeatureLayer.selectFeatures(selectQuery, this.routeLayer
          .layerObject.SELECTION_NEW, null, lang.hitch(this,
            function (err) {
              if (err) {
                this._showAlertMessage(err.message);
              }
            }));
        this.attInspector.refresh();
        // if applied Theme is for widget is dart Theme and browser is IE9
        if (this.appConfig.theme.name === "DartTheme" && has("ie") ===
          9) {
          this._setDartBackgroudColorForIE9();
        }

      }
    },

    /**
    * This function is used to filter the fields of route layer which are editable
    * return{array}: array containing all the editable fields of route layer
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _filterRouteLayerFieldInfo: function () {
      var i, j, fieldInfoArr = [];
      if (this.routeLayer && this.routeLayer.title) {
        for (j = 0; j < this.map.webMapResponse.itemInfo.itemData.operationalLayers
          .length; j++) {
          for (i = 0; i < this.map.webMapResponse.itemInfo.itemData.operationalLayers[
              j].popupInfo.fieldInfos.length; i++) {
            if (this.map.webMapResponse.itemInfo.itemData.operationalLayers[
                j].title === this.routeLayer.title) {
              if (this.map.webMapResponse.itemInfo.itemData.operationalLayers[
                  j].popupInfo.fieldInfos[i].isEditable) {
                fieldInfoArr.push(this.map.webMapResponse.itemInfo.itemData
                  .operationalLayers[j].popupInfo.fieldInfos[i]);
              }
            }
          }
        }
      }

      return fieldInfoArr;
    },

    layerFieldsToFieldInfos: function () {
      var fieldInfo = null,
        layer = null,
        routeFieldInfo = [],
        j;
      if (this.routeLayer && this.routeLayer.title) {
        for (j = 0; j < this.map.webMapResponse.itemInfo.itemData.operationalLayers
          .length; j++) {
          if (this.map.webMapResponse.itemInfo.itemData.operationalLayers[
              j].title === this.routeLayer.title) {
            routeFieldInfo = this.map.webMapResponse.itemInfo.itemData
              .operationalLayers[j].popupInfo.fieldInfos;
            break;
          }
        }

        if (routeFieldInfo !== null) {
          array.forEach(routeFieldInfo, function (fieldInfo) {
            if (fieldInfo.format && fieldInfo.format !== null) {
              if (fieldInfo.format.dateFormat && fieldInfo.format
                .dateFormat !== null) {
                if (fieldInfo.format.dateFormat ===
                  "shortDateShortTime" ||
                  fieldInfo.format.dateFormat ===
                  "shortDateShortTime24" ||
                  fieldInfo.format.dateFormat ===
                  "shortDateLEShortTime" ||
                  fieldInfo.format.dateFormat ===
                  "shortDateLEShortTime24") {
                  fieldInfo.format.time = true;
                }


              }
            }
          });
          fieldInfo = routeFieldInfo;
        }

        if (fieldInfo === null) {
          fieldInfo = array.map(layer.layerObject.fields, function (
            field) {
            return {
              "fieldName": field.name,
              "isEditable": field.editable,
              "tooltip": field.alias,
              "label": field.alias,
              "format": {
                "time": true
              }
            };
          });
        }
      }
      return array.filter(fieldInfo, function (field) {
        return field.isEditable;
      });
    },

    /**
    * This function is used to bind the event for business Layer checkBox in "Save to Layer" panel
    * @params{object}checkBox: Checkbox for saving business layer
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onBusinessLayerCheck: function (checkBox) {
      on(checkBox, "click", lang.hitch(this, function (event) {
        if (domClass.contains(event.target, "checked")) {
          domClass.add(event.currentTarget,
            "esriCTSaveCheckbox");
          if (array.indexOf(this.checkedLayers, event.currentTarget) ===
            -1) {
            this.checkedLayers.push(event.currentTarget);
            this.saveToLayerBtn.disabled = false;
            domClass.remove(this.saveToLayerBtn,
              "jimu-state-disabled");
          }
        } else {
          domClass.remove(event.currentTarget,
            "esriCTSaveCheckbox");
          if (array.indexOf(this.checkedLayers, event.currentTarget) !==
            -1) {
            this.checkedLayers.splice(array.indexOf(this.checkedLayers,
              event.currentTarget), 1);
          }
          if (this.checkedLayers.length === 0) {
            this.saveToLayerBtn.disabled = true;
            domClass.add(this.saveToLayerBtn,
              "jimu-state-disabled");
          }
        }
      }));
    },

    /**
    * This function is used to set visibility for "Save to Layer" panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _setDisplayForPanels: function () {
      var j;
      if (this.saveLayerClicked) {
        domStyle.set(this.resultContainer, "display", "none");
        domStyle.set(this.businessTitleContainer, "display", "none");
        domStyle.set(this.resultListContainer, "display", "none");
        domClass.remove(this.saveLayercontentContainer,
          "esriCTHidePanel");
        domClass.remove(this.saveToLayerContainer, "esriCTHidePanel");
        domConstruct.empty(this.saveLayerTitleContainer);
        domClass.remove(this.saveLayerTitleContainer,
          "esriCTHidePanel");
        domClass.replace(this.divExportToLayerButtons,
          "esriCTHidePanel", "esriCTShowPanel");
      } else if (this.isClearClicked) {
        domClass.add(this.saveLayercontentContainer,
          "esriCTHidePanel");
        domClass.add(this.saveLayerTitleContainer, "esriCTHidePanel");
      } else {
        for (j = 0; j < this.tabContainer.controlNodes.length; j++) {
          if (!this.isResultExist) {
            domStyle.set(this.tabContainer.controlNodes[j], "display",
              "block");
          }
        }
        domStyle.set(this.resultContainer, "display", "block");
        if (this.config.AllowBusinessOptional) {
          domStyle.set(this.resultListContainer, "display",
            "block");
          domStyle.set(this.businessTitleContainer, "display",
            "block");
        } else {
          domStyle.set(this.resultListContainer, "display",
            "none");
          domStyle.set(this.businessTitleContainer, "display",
            "none");
        }
        domClass.add(this.saveLayercontentContainer,
          "esriCTHidePanel");
        domClass.add(this.saveToLayerContainer, "esriCTHidePanel");
        domClass.replace(this.divExportToLayerButtons,
          "esriCTShowPanel", "esriCTHidePanel");
      }
    },

    /**
    * This function is used to create dom elements for Business Passed and route length, when Route layer check box is checked
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createRouteLayerCheck: function () {
      var routeLayerDiv, routeLayerContainer, checkQuery;
      checkQuery = query(".clearInstance");
      if (checkQuery) {
        checkQuery.forEach(domConstruct.destroy);
      }
      routeLayerDiv = domConstruct.create("div", {
        "class": "clearInstance"
      }, this.routeLayerChkbox);
      routeLayerContainer = domConstruct.create("div", {
        "class": "clearInstance"
      }, routeLayerDiv);
      this.routeLayerChk = new CheckBox({
        "class": "esriCTRouteChkBox clearInstance"
      }, routeLayerContainer);
      domConstruct.create("label", {
        "class": "esriCTRouteLayerLabel clearInstance",
        "innerHTML": this.nls.saveRouteLayerLabel
      }, routeLayerContainer);
      domAttr.set(this.routeLayerChk.domNode, "title", this.config.targetRouteLayer);
      domClass.add(this.esriCTSaveBusinessRouteLength,
        "esriCTHidePanel");
      this._onRouteLayerCheck(this.routeLayerChk.domNode);
    },

    /**
    * This function will save the results on the checked layers given in "Save to Layer" panel
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _onSaveBtnClick: function () {
      var businessLayer, routeLayer, isBusinessLayerSave = false,
        isRouteLayerSave = false,
        i, j;
      this.showLoadingIndicator();
      for (i = 0; i < this.checkedLayers.length; i++) {
        if (domAttr.get(this.checkedLayers[i], "title") === this.config
          .targetBusinessLayer) {
          isBusinessLayerSave = true;
        } else if (domAttr.get(this.checkedLayers[i], "title") ===
          this.config.targetRouteLayer) {
          isRouteLayerSave = true;
        }
        if (isBusinessLayerSave && isRouteLayerSave) {
          break;
        }
      }
      for (j = 0; j < this.map.itemInfo.itemData.operationalLayers.length; j++) {
        if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          this.config.targetBusinessLayer && isBusinessLayerSave) {
          businessLayer = this.map.itemInfo.itemData.operationalLayers[
            j].layerObject;
        } else if (this.map.itemInfo.itemData.operationalLayers[j].title ===
          this.config.targetRouteLayer && isRouteLayerSave) {
          routeLayer = this.map.itemInfo.itemData.operationalLayers[j]
            .layerObject;
        }
        if (businessLayer && routeLayer) {
          break;
        }
      }
      if (businessLayer && isBusinessLayerSave) {
        this._addDataInBusinessLayer(businessLayer, routeLayer);
      } else if (routeLayer && isRouteLayerSave) {
        this._addDataInRouteLayer(routeLayer, false);
      }
    },

    /**
    * This function will save the features on feature layer
    * @params{object}businessLayer: Business feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addDataInBusinessLayer: function (businessLayer, routeLayer) {
      if (routeLayer && this.routeFeatureLayer && this.routeFeatureLayer
        .graphics.length > 0) {
        array.forEach(this.businessGraphicArray, lang.hitch(this,
          function (feature) {
            if (feature) {
              feature.attributes[this.config.FieldMappingData.bussinessLayerField] =
                this.routeFeatureLayer.graphics[0].attributes[
                  this.config.FieldMappingData.routeLayerField];
            }
          }));
      }
      if (this.businessGraphicArray && this.businessGraphicArray.length >
        0) {
        if (!this._businessDataSaved) {
          this._addToBusinessLayer(businessLayer, routeLayer);
        } else if (this._changeInField) {
          this._updateBusinessLayer(businessLayer, routeLayer);
        } else if (this.checkedLayers.length === 2 && routeLayer) {
          this._showAlertMessage(this.nls.noChangesToSave);
          this._addDataInRouteLayer(routeLayer, false);
        } else {
          this._hideLoadingIndicator();
          this._showAlertMessage(this.nls.noChangesToSave);
          this.saveLayerClicked = false;
          this._setDisplayForPanels();
        }
      }
    },

    /**
    * This function will save the businesses on layer
    * @params{object}businessLayer:Business feature layer on map
    * @params{object}routeLayer:Route feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addToBusinessLayer: function (businessLayer, routeLayer) {
      var businessLayerSuccess;
      businessLayer.applyEdits(this.businessGraphicArray, null, null,
        lang.hitch(this, function (results) {
          businessLayerSuccess = results && results.length > 0 &&
            results[0].success ? true : false;
          if (routeLayer && this.checkedLayers.length === 2) {
            this._addDataInRouteLayer(routeLayer,
              businessLayerSuccess);
          }
          if (results && results.length > 0 && results[0].success) {
            businessLayer.refresh();
            this._changeInField = false;
            this._businessDataSaved = true;
            if (this.checkedLayers.length === 1) {
              this.saveLayerClicked = false;
              this._setDisplayForPanels();
              this._showAlertMessage(string.substitute(this.nls.saveToLayerSuccess, [
                this.nls.businessLayerLabel
              ]));
              this._hideLoadingIndicator();
            }
          } else {
            this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
              this.nls.businessLayerLabel
            ]));
            this._hideLoadingIndicator();
          }
        }), lang.hitch(this, function () {
          if (this.checkedLayers.length === 1) {
            this.saveLayerClicked = false;
            this._setDisplayForPanels();
          }
          this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
            this.nls.businessLayerLabel
          ]));
          this._hideLoadingIndicator();
        }));
    },

    /**
    * This function will update the saved business features on layer
    * @params{object}businessLayer:Business feature layer on map
    * @params{object}routeLayer:Route feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _updateBusinessLayer: function (businessLayer, routeLayer) {
      var businessLayerSuccess;
      businessLayer.applyEdits(null, this.businessGraphicArray, null,
        lang.hitch(this, function (addResults, updateResults, // jshint ignore:line
          delResults) { // jshint ignore:line
          businessLayerSuccess = updateResults && updateResults.length >
            0 && updateResults[0].success ? true : false;
          if (routeLayer && this.checkedLayers.length === 2) {
            this._addDataInRouteLayer(routeLayer,
              businessLayerSuccess);
          }
          if (updateResults && updateResults.length > 0 &&
            updateResults[0].success) {
            businessLayer.refresh();
            if (this.checkedLayers.length === 1) {
              this.saveLayerClicked = false;
              this._setDisplayForPanels();
              this._showAlertMessage(string.substitute(this.nls.saveToLayerSuccess, [
                this.nls.businessLayerLabel
              ]));
              this._hideLoadingIndicator();
            }
          } else {
            this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
              this.nls.businessLayerLabel
            ]));
            this._hideLoadingIndicator();
          }
        }), lang.hitch(this, function () {
          if (this.checkedLayers.length === 1) {
            this.saveLayerClicked = false;
            this._setDisplayForPanels();
          }
          this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
            this.nls.businessLayerLabel
          ]));
          this._hideLoadingIndicator();
        }));
    },

    /**
    * This function will call the appropriate function after determining whether the state of route is saved or unsaved on layer
    * @params{object}routeLayer:Route feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addDataInRouteLayer: function (routeLayer, businessLayerSuccess) {
      if (this.routeFeatureLayer && this.routeFeatureLayer.graphics.length >
        0) {
        if (!this._routeDataSaved) {
          this._addToRouteFeatureLayer(routeLayer,
            businessLayerSuccess);
        } else {
          this._updateRouteFeatureLayer(routeLayer,
            businessLayerSuccess);
        }
      }
    },

    /**
    * This function will save the route graphic on layer
    * @params{object}routeLayer:Route feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _addToRouteFeatureLayer: function (routeLayer, businessLayerSuccess) {
      var routeGraphic, savedLayers;
      routeGraphic = new Graphic(this.routeFeatureLayer.graphics[0].geometry,
        null, this.routeFeatureLayer.graphics[0].attributes);
      routeGraphic.attributes[this.routeFeatureLayer.objectIdField] =
        null;
      routeLayer.applyEdits([routeGraphic], null, null, lang.hitch(
        this,
        function (results) {
          this.saveLayerClicked = false;
          this._setDisplayForPanels();
          if (results && results[0] && results[0].success) {
            routeLayer.refresh();
            this._routeDataSaved = true;
            this.resultId = results[0].objectId;
            savedLayers = businessLayerSuccess && this.checkedLayers
              .length === 2 ? this.nls.saveRouteLayerLabel + ", " +
              this.nls.businessLayerLabel : this.nls.saveRouteLayerLabel;
            this._showAlertMessage(string.substitute(this.nls.saveToLayerSuccess, [
              savedLayers
            ]));
            this._hideLoadingIndicator();
          } else {
            this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
              this.nls.saveRouteLayerLabel
            ]));
            this._hideLoadingIndicator();
          }
        }), lang.hitch(this, function () {
          this.saveLayerClicked = false;
          this._setDisplayForPanels();
          this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
          this.nls.saveRouteLayerLabel
        ]));
          this._hideLoadingIndicator();
        }));
    },

    /**
    * This function will update saved route graphic on the layer
    * @params{object}routeLayer:Route feature layer on map
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _updateRouteFeatureLayer: function (routeLayer, businessLayerSuccess) {
      var routeGraphic, savedLayers;
      routeGraphic = new Graphic(this.routeFeatureLayer.graphics[0].geometry,
        null, this.routeFeatureLayer.graphics[0].attributes);
      if (routeGraphic && routeGraphic.attributes) {
        routeGraphic.attributes[this.routeFeatureLayer.objectIdField] =
          this.resultId;
        routeLayer.applyEdits(null, [routeGraphic], null, lang.hitch(
          this,
          function (addResults, updateResults, delResults) { // jshint ignore:line
            this.saveLayerClicked = false;
            this._setDisplayForPanels();
            if (updateResults && updateResults[0] &&
              updateResults[0].success) {
              routeLayer.refresh();
              savedLayers = businessLayerSuccess && this.checkedLayers
                .length === 2 ? this.nls.saveRouteLayerLabel +
                ", " + this.nls.businessLayerLabel : this.nls.saveRouteLayerLabel;
              this._showAlertMessage(string.substitute(this.nls.saveToLayerSuccess, [
                savedLayers
              ]));
              this._hideLoadingIndicator();
            } else {
              this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
                this.nls.saveRouteLayerLabel
              ]));
              this._hideLoadingIndicator();
            }
          }), lang.hitch(this, function () {
            this.saveLayerClicked = false;
            this._setDisplayForPanels();
            this._showAlertMessage(string.substitute(this.nls.saveToLayerFailed, [
            this.nls.saveRouteLayerLabel
          ]));
            this._hideLoadingIndicator();
          }));
      }
    },

    /**
    * This function will get the center of polyline geometry
    * @params{object}polyline: polyline geometry
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _getLineCenter: function (polyline) {
      var path, pointIndex, startPoint, endPoint, polylinePoint;
      path = polyline.paths[Math.round(polyline.paths.length / 2) - 1];
      pointIndex = Math.round((path.length - 1) / 2) - 1;
      startPoint = path[pointIndex];
      endPoint = path[pointIndex + 1];
      polylinePoint = new Point((startPoint[0] + endPoint[0]) / 2.0, (
        startPoint[1] + endPoint[1]) / 2.0, polyline.spatialReference);
      return polylinePoint;
    },

    /**
    * This function will get the centroid of polygon geometry
    * @params{object}polyline: polygon geometry
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _getPolygonCentroid: function (polygon) {
      var ring, centroid, i, polygonPoint, polylinePoint;
      ring = polygon.rings[Math.round(polygon.rings.length / 2) - 1];
      centroid = {
        x: 0,
        y: 0
      };
      // Array object
      for (i = 0; i < ring.length; i++) {
        polygonPoint = ring[i];
        centroid.x += polygonPoint[0];
        centroid.y += polygonPoint[1];
      }
      centroid.x /= ring.length;
      centroid.y /= ring.length;
      polylinePoint = new Point(centroid.x, centroid.y, polygon.spatialReference);
      return polylinePoint;
    },

    /**
    * This function will set timer for ripple effect on selected feature
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createTimer: function () {
      var animatedSymbol, animatedRenderer, jsonObj, baseURL, imgURL;
      if (this.config && this.config.highlighterDetails && this.config
        .highlighterDetails.timeout) {
        this.timer = new Timing.Timer(this.config.highlighterDetails.timeout);
        this.highlightGraphicLayer = new GraphicsLayer();

        if (this.config.highlighterDetails.imageData.indexOf(
            "default") > -1) {
          imgURL = this.config.highlighterDetails.imageData.slice(
            this.config.highlighterDetails.imageData.indexOf(
              "widgets"));
          imgURL = imgURL.replace(/\/\//g, "/");
        } else {
          imgURL = this.config.highlighterDetails.imageData;
        }

        baseURL = location.href.slice(0, location.href.lastIndexOf(
          '/'));
        jsonObj = {
          "type": "esriPMS",
          "url": string.substitute(imgURL, {
            appPath: baseURL
          }),
          "imageData": "",
          "contentType": "image/png",
          "color": null,
          "width": this.config.highlighterDetails.width,
          "height": this.config.highlighterDetails.height,
          "angle": 0,
          "xoffset": 0,
          "yoffset": 0
        };
        animatedSymbol = this._createGraphicFromJSON(jsonObj);
        animatedRenderer = new SimpleRenderer(animatedSymbol);
        this.highlightGraphicLayer.setRenderer(animatedRenderer);
        this.map.addLayer(this.highlightGraphicLayer);
        this.timer.onTick = lang.hitch(this, function () {
          this.timer.stop();
          this.highlightGraphicLayer.clear();
        });
      }
    },

    /**
    * This function will show all the alert and error messages
    * @params{object}msg: object contains the message content
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _showAlertMessage: function (msg) {
      var alertMsg = new Message({
        message: msg
      });
      alertMsg.message = msg;
    },

    /**
    * This function will hide the loading indicator
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _hideLoadingIndicator: function () {
      if (this.loading) {
        this.loading.hide();
      }
    },

    /**
    * This function will return the symbol as per the provided JSON.
    * @param{object} json: The JSON object from which symbol will be returned.
    * @return{object} symbol:Symbol can be simplefillsymbol, simplemarkersymbol, simplelinesymbol or picturemarkersymbol.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _createGraphicFromJSON: function (json) {
      var symbol;
      symbol = symbolJsonUtils.fromJson(json);
      return symbol;
    },

    /**
    * This function will return the symbol JSON of the provided symbol type.
    * @param{object} symbolType: The type of symbol to be converted to JSON.
    * @return{object} symbol: symbol JSON.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _getSymbolJson: function (symbolType) {
      var symbolData, i, symbolObjFlag = false,
        key;
      if (this.config && this.config.symbol && this.config.symbol.length &&
        this.config.symbol.length > 0) {
        for (i = 0; i < this.config.symbol.length; i++) {
          for (key in this.config.symbol[i]) {
            if (this.config.symbol[i].hasOwnProperty(key)) {
              if (key === symbolType) {
                symbolData = this.config.symbol[i][key];
                symbolObjFlag = true;
                break;
              }
            }
          }
          // flag is true then break the loop
          if (symbolObjFlag) {
            break;
          }
        }
      }
      return symbolData;
    },

    /**
    * This function will modify styling for the business passed label
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _enhancedStyling: function () {
      if (this.businessPassedResultListLabel) {
        domClass.remove(this.businessPassedResultListLabel,
          "esriCTListLabelCSV");
        domClass.remove(this.businessPassedResultListLabel,
          "esriCTListLabelArrow");
        domClass.remove(this.businessPassedResultListLabel,
          "esriCTListLabelFullWidth");
        if (this.config.exportToCSV) {
          domClass.add(this.businessPassedResultListLabel,
            "esriCTListLabelCSV");
        } else {
          domClass.add(this.businessPassedResultListLabel,
            "esriCTListLabelArrow");
        }
      }
    },

    /**
    * Function for getting string required to be replaced in expression
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _getStringValue: function (val) {
      var string, stringValue, replaceStringStartPos,
        replaceStringEndPos, replaceString, replaceBy;
      stringValue = this.config.ExpressionValue;
      replaceStringStartPos = stringValue.indexOf("{");
      replaceStringEndPos = stringValue.indexOf("}") + 1;
      replaceString = stringValue.substring(replaceStringStartPos,
        replaceStringEndPos);
      replaceBy = new RegExp(replaceString, 'g');
      string = stringValue.replace(replaceBy, val);
      return string;
    },

    /**
    * Function for setting dart theme background color on IE 9
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _setDartBackgroudColor: function () {
      var mainDivContainer;
      if (this.appConfig.theme.name === "DartTheme" && has("ie") ===
        9) {
        mainDivContainer = query(".jimu-widget-frame.jimu-container")[
          0];
        domClass.add(mainDivContainer, "esriCTDartBackgroudColor");
      }
    },

    /**
    * This function is used to add focus class on text box click for IE9
    * @param{object} Element node to which class needs to be added
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _addFocusClassOnTextBoxClick: function (textBoxNode) {
      var dijitTextBoxFocusedIE9div, dijitTextBoxFocuseddiv, j;
      domClass.add(textBoxNode, "dijitTextBoxIE9");
      // binding events for changing CSS on click of input Div
      // in dart theme and in case of  IE9
      on(textBoxNode, "click", lang.hitch(this, function () {
        dijitTextBoxFocusedIE9div = query(
          ".dijitTextBoxFocusedIE9");
        dijitTextBoxFocuseddiv = query(".dijitTextBoxFocused")[
          0];
        // loop for removing classes of focused node from all dijitTextBox
        for (j = 0; j < dijitTextBoxFocusedIE9div.length; j++) {
          domClass.remove(dijitTextBoxFocusedIE9div[j],
            "dijitTextBoxFocusedIE9");
        }
        domClass.add(dijitTextBoxFocuseddiv,
          "dijitTextBoxFocusedIE9");
      }));
    },

    /**
    * This function is used to add focus class on date change for IE9
    * @param{object} Element node to which class needs to be added
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _addFocusClassOnDateChange: function (inputNode) {
      var dijitTextBoxFocusedIE9div, dijitTextBoxFocuseddiv, j;
      // binding events for changing CSS on change of input Div
      // in dart theme and in case of  IE9
      on(inputNode, "change", lang.hitch(this, function () {
        dijitTextBoxFocusedIE9div = query(
          ".dijitTextBoxFocusedIE9");
        dijitTextBoxFocuseddiv = query(".dijitTextBoxFocused")[
          0];
        // loop for removing classes of focused node from all dijitTextBox
        for (j = 0; j < dijitTextBoxFocusedIE9div.length; j++) {
          domClass.remove(dijitTextBoxFocusedIE9div[j],
            "dijitTextBoxFocusedIE9");
        }
        domClass.add(dijitTextBoxFocuseddiv,
          "dijitTextBoxFocusedIE9");
      }));
    },

    /**
    * This function is used to add class on focus of dijit input for IE9
    * @param{object} Element node to which class needs to be added
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _addClassOnFocus: function (inputNode) {
      var dijitTextBoxFocusedIE9div, dijitTextBoxFocuseddiv, j;
      // binding events for changing CSS on focus of input Div
      // in dart theme and in case of  IE9
      on(inputNode, "focus", lang.hitch(this, function () {
        dijitTextBoxFocusedIE9div = query(
          ".dijitTextBoxFocusedIE9");
        dijitTextBoxFocuseddiv = query(".dijitTextBoxFocused")[
          0];
        // loop for removing classes of focused node from all dijitTextBox
        for (j = 0; j < dijitTextBoxFocusedIE9div.length; j++) {
          domClass.remove(dijitTextBoxFocusedIE9div[j],
            "dijitTextBoxFocusedIE9");
        }
        domClass.add(dijitTextBoxFocuseddiv,
          "dijitTextBoxFocusedIE9");
      }));
    },

    /**
    * This function is used to add class on click of dijit select for IE9
    * @param{object} Element node to which class needs to be added
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _addClassOnSelectClick: function (selectNode) {
      on(selectNode, "click", lang.hitch(this, function () {
        var dijitMenuItemHoverDiv, dijitMenuItemSelectedDiv, i,
          dijitMenuPopupDiv, dijitMenuItemDiv, dijitMenuDiv;
        dijitMenuItemSelectedDiv = query(
          ".dijitMenuItemSelected");
        dijitMenuItemHoverDiv = query(".dijitMenuItemHover");
        dijitMenuPopupDiv = query(".dijitMenuPopup");
        dijitMenuItemDiv = query(".dijitMenuItem");
        dijitMenuDiv = query(".dijitMenu");
        // loop for adding class for applying CSS on div of menu popup
        for (i = 0; i < dijitMenuPopupDiv.length; i++) {
          domClass.add(dijitMenuPopupDiv[i],
            "dijitMenuPopupIE9");
        }
        // loop for adding class for applying CSS on div of menu item
        for (i = 0; i < dijitMenuItemDiv.length; i++) {
          domClass.add(dijitMenuItemDiv[i], "dijitMenuItemIE9");
        }
        // loop for adding class for applying CSS on div of menu
        for (i = 0; i < dijitMenuDiv.length; i++) {
          domClass.add(dijitMenuDiv[i], "dijitMenuIE9");
        }
      }));
    },

    /**
    * Function for setting dart theme background color on IE 9
    * @memberOf widgets/ServiceFeasibility/Widget
    */
    _setDartBackgroudColorForIE9: function () {
      var dijitTextBoxdiv, dijitButtonNodediv, i, dijitInputInnerdiv,
        dijitArrowButtondiv, dijitSelectDiv;
      dijitTextBoxdiv = query(".dijitTextBox");
      dijitButtonNodediv = query(".dijitButtonNode");
      dijitInputInnerdiv = query(".dijitInputInner");
      dijitArrowButtondiv = query(".dijitArrowButton");
      dijitSelectDiv = query(".dijitSelect");
      // loop for adding class for applying CSS on div of arrow button node
      // in dart theme in case of  IE9
      for (i = 0; i < dijitArrowButtondiv.length; i++) {
        domClass.add(dijitArrowButtondiv[i], "dijitArrowButtonIE9");
      }
      // loop for adding class for applying CSS on input field of div text box div
      // in dart theme in case of  IE9
      for (i = 0; i < dijitTextBoxdiv.length; i++) {
        this._addFocusClassOnTextBoxClick(dijitTextBoxdiv[i]);
      }
      // loop for adding class for applying CSS on input field of div text box div
      // in dart theme in case of  IE9
      for (i = 0; i < dijitInputInnerdiv.length; i++) {
        this._addFocusClassOnDateChange(dijitInputInnerdiv[i]);
        this._addClassOnFocus(dijitInputInnerdiv[i]);
      }
      // loop for adding class for applying CSS on button div of select div
      // in dart theme in case of  IE9
      for (i = 0; i < dijitButtonNodediv.length; i++) {
        domClass.add(dijitButtonNodediv[i], "dijitButtonNodeIE9");
      }
      // loop for adding class for applying CSS on select div of dijit select
      // in dart theme in case of  IE9
      for (i = 0; i < dijitSelectDiv.length; i++) {
        domClass.add(dijitSelectDiv[i], "dijitSelectIE9");
        this._addClassOnSelectClick(dijitSelectDiv[i]);
      }
    }
  });
});