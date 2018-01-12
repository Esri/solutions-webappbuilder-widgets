/*global define */
///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
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
define([
  "dojo/_base/declare",
  "jimu/BaseWidget",
  "dojo/on",
  "dojo/_base/lang",
  "dojo/window",
  "esri/graphic",
  "esri/geometry/Point",
  "esri/tasks/Geoprocessor",
  "dojo/_base/array",
  "esri/layers/GraphicsLayer",
  "esri/renderers/SimpleRenderer",
  "esri/toolbars/draw",
  "dojo/dom-class",
  "esri/tasks/FeatureSet",
  "dojo/dom-construct",
  "dojox/timing",
  "dojo/query",
  "dojo/promise/all",
  "dojo/Deferred",
  "esri/InfoTemplate",
  "dijit/registry",
  "dojo/date/locale",
  "dojo/dom-attr",
  "dojo/string",
  "jimu/PanelManager",
  "dojo/dom-style",
  "esri/symbols/jsonUtils",
  "jimu/dijit/Message",
  "jimu/dijit/CheckBox",
  "esri/dijit/AttributeInspector",
  "esri/geometry/geometryEngine",
  "esri/layers/FeatureLayer",
  "esri/request",
  "esri/tasks/query",
  "jimu/dijit/TabContainer",
  "dojo/dom",
  "dojo/has",
  'jimu/utils',
  'jimu/exportUtils',
  "dojo/sniff"
], function (
  declare,
  BaseWidget,
  on,
  lang,
  dojoWindowClass,
  Graphic,
  Point,
  Geoprocessor,
  array,
  GraphicsLayer,
  SimpleRenderer,
  Draw,
  domClass,
  FeatureSet,
  domConstruct,
  Timing,
  query,
  all,
  Deferred,
  InfoTemplate,
  registry,
  dateLocale,
  domAttr,
  string,
  PanelManager,
  style,
  symbolJsonUtils,
  JimuMessage,
  Checkbox,
  AttributeInspector,
  geometryEngine,
  FeatureLayer,
  esriRequest,
  Query,
  JimuTabContainer,
  dom,
  has,
  utils,
  exportUtils
) {
  return declare([BaseWidget], {
    baseClass: 'jimu-widget-NetworkTrace',
    viewPortSize: null,
    panelManager: null,
    wManager: null,
    flagBtnClicked: false,
    barrierBtnClicked: false,
    gp: null,
    gpInputDetails: null,
    toolbar: null,
    overExtent: null,
    resultsCnt: null,
    resultLayers: null,
    animatedLayer: null,
    computedPanelStyle: null,
    mainContainer: null,
    exportToLayerCheckBox: null,
    tooltipDialog: null,
    IsIE: null,
    IsSafari: null,
    IsOpera: null,
    errorLayerArray: [],
    attInspector: null,
    overviewGraphicsLayer: null,
    _inputGeomConvexHull: [],
    _flagID: null, // flag ObjId counter
    _barrierID: null, //block ObjId counter
    _inputFlag: null, //input Loc Label counter
    _inputBlock: null, //block Loc Label counter
    _flagCount: null, // input feature count
    _barrierCount: null, //block feature count
    _tabContainer: null, // to store object of tab container
    _outputResultCount: 0, // to track count of output service execution
    _outputResultArr: [], // to store output response
  _numTimesOpened: 0,
    savedLayers: [],
    savedFeatureObjectId: null,

    /**
    *This is a startup function of a network trace widget.
    **/
    startup: function () {
      var widgetPanel;
      this.inherited(arguments);
      if (this._validateConfigParams()) {
        this._initializingJimuTabContainer();
        this._getFieldAliasFromGPService();
        this.IsOpera = !!window.opera || navigator.userAgent.indexOf(
          ' OPR/') >= 0;
        this.IsSafari = Object.prototype.toString.call(window.HTMLElement)
          .indexOf('Constructor') > 0;
        this.IsIE = !!document.documentMode || false;
        on(this.map, "click", lang.hitch(this, this._onMapClick));
        this.gp = new Geoprocessor(this.config.geoprocessing.url);
        on(this.gp, "error", lang.hitch(this, this._onSubmitJobError));
        on(this.gp, "job-complete", lang.hitch(this, this._onSubmitJobComplete));
        this.gp.setOutSpatialReference(this.map.spatialReference);
        this._setDisplayTextForRunButton();
        this._createResultPanels();
        this._createGraphic();
        this._createTimer();
        this.viewPortSize = dojoWindowClass.getBox();
        this.panelManager = PanelManager.getInstance();
        this._enhanceTabThemeStyle();
        this._enhanceDartThemeStyle();
        this._setTheme();
        widgetPanel = query(".jimu-widget-NetworkTrace")[0];
        if (widgetPanel) {
          style.set(widgetPanel, {
            "z-index": 101,
            "position": "static"
          });
        }
      }
    },

    /**
    * This function will initialize jimu tab container.
    * @memberOf widgets/ServiceFeasibility/Widget
    **/
    _initializingJimuTabContainer: function () {
      this._tabContainer = new JimuTabContainer({
        tabs: [{
          title: this.nls.inputTabTitle,
          content: this.inputTabPanel,
          selected: true
        }, {
          title: this.nls.outputTabTitle,
          content: this.outputTab,
          selected: false
        }]
      }, this.tabContainerNetworkTrace);
      this._tabContainer.startup();
    },
    /*jshint unused:true */
    _setTheme: function () {

      var styleLink;
      if (this.appConfig.theme.name === "DartTheme") {
        utils.loadStyleLink('dartOverrideCSS', this.folderUrl + "/css/dartTheme.css", null);
      }
      else {
        styleLink = document.getElementById("dartOverrideCSS");
        if (styleLink) {
          styleLink.disabled = true;
        }
      }

    },
    destroy: function () {
      this._clearResults();
      this._removeAllGraphicLayers();
      this.inherited(arguments);
    },

  /**
     * Add back the graphic layers upon opening.
     */
    onOpen: function() {
      this._numTimesOpened = this._numTimesOpened + 1;

      if (this._numTimesOpened > 1) {
        this._addGraphicLayersBackToMap();
      }

      this.inherited(arguments);
    },

    /**
     * Clear the results and remove all graphic layers upon closing.
     */
    onClose: function() {
      this._clearResults();
      this._removeAllGraphicLayers();
      this.inherited(arguments);
    },

  /**
   * Adds all graphic layers back to the map if they already exist.  This allows
   * multiple instances of the network trace widget to be used in the same application.
   *
   * @private
   */
  _addGraphicLayersBackToMap: function() {
      for (var i in this.resultLayers) {
        this.map.addLayer(this.resultLayers[i]);
      }

      if (this.overviewInfo && this.overviewInfo.layer) {
        this.map.addLayer(this.overviewInfo.layer);
      }

      if (this.overviewGraphicsLayer) {
        this.map.addLayer(this.overviewGraphicsLayer);
      }

      if (this.animatedLayer) {
        this.map.addLayer(this.animatedLayer);
      }

      for (var k in this.gpInputDetails) {
        this.map.addLayer(this.gpInputDetails[k]);
      }
  },

    /**
    * This function will set the display text for run button
    **/
    _setDisplayTextForRunButton: function () {
      if (this.config.displayTextForRunButton) {
        this.btnTrace.innerHTML = this.config.displayTextForRunButton;
      } else {
        this.btnTrace.innerHTML = "Run";
      }
    },

    /**
    *This function will validate the widget configuration parameters.
    **/
    _validateConfigParams: function () {
      var isConfigParam;
      //checking whether this.config has primary objects or not.
      if (this.config.hasOwnProperty("highlighterDetails") && this.config
        .hasOwnProperty("geoprocessing")) {
        //checking whether url, inputs and output are present or not.
        if (this.config.geoprocessing.hasOwnProperty("url") && this.config
          .geoprocessing.hasOwnProperty("inputs") && this.config.geoprocessing
          .hasOwnProperty("outputs")) {
          if (this.config.geoprocessing.inputs.length > 0 && this.config
            .geoprocessing.outputs.length > 0 && this.config.geoprocessing
            .url !== "") {
            isConfigParam = true;
          } else {
            this._errorMessage(this.nls.configError);
            isConfigParam = false;
          }
        } else {
          this._errorMessage(this.nls.configError);
          isConfigParam = false;
        }
      } else {
        this._errorMessage(this.nls.configError);
        isConfigParam = false;
      }
      return isConfigParam;
    },

    /**
    *This function will execute when user clicked on flag button.
    **/
    _onFlagButtonClick: function () {
      if (!domClass.contains(this.btnFlag, "traceControlDisabledDiv")) {
        if (!this.flagBtnClicked) {
          this.flagBtnClicked = true;
          domClass.remove(this.btnFlag, "flagbutton");
          domClass.add(this.btnFlag, "flagButtonselected");
          //Checking the toolbar whether it is initialized or not
          if (this.toolbar === null) {
            this.toolbar = new Draw(this.map);
            this.toolbar.activate(Draw.POINT);
          }
          //Checking whether barrier button was clicked or not.
          if (this.barrierBtnClicked) {
            this.barrierBtnClicked = false;
            domClass.remove(this.btnBarrier, "barrierButtonselected");
            domClass.add(this.btnBarrier, "barrierButton");
          }
          this.disableWebMapPopup();
        } else {
          this.enableWebMapPopup();
          this.flagBtnClicked = false;
          domClass.remove(this.btnFlag, "flagButtonselected");
          domClass.add(this.btnFlag, "flagbutton");
          //Checking the toolbar whether it is initialized or not
          if (this.toolbar !== null) {
            this.toolbar.deactivate();
            this.toolbar = null;
          }
        }
      }
    },

    /**
    *This function will execute when user clicked on Barrier Button.
    **/
    _onBarrierButtonClick: function () {
      if (!domClass.contains(this.btnBarrier,
          "traceControlDisabledDiv")) {
        if (!this.barrierBtnClicked) {
          this.barrierBtnClicked = true;
          domClass.remove(this.btnBarrier, "barrierButton");
          domClass.add(this.btnBarrier, "barrierButtonselected");
          //Checking the toolbar whether it is initialized or not
          if (this.toolbar === null) {
            this.toolbar = new Draw(this.map);
            this.toolbar.activate(Draw.POINT);
          }
          //Checking whether flag button was clicked or not.
          if (this.flagBtnClicked) {
            this.flagBtnClicked = false;
            domClass.remove(this.btnFlag, "flagButtonselected");
            domClass.add(this.btnFlag, "flagbutton");
          }
          this.disableWebMapPopup();
        } else {
          this.enableWebMapPopup();
          this.barrierBtnClicked = false;
          domClass.remove(this.btnBarrier, "barrierButtonselected");
          domClass.add(this.btnBarrier, "barrierButton");
          //Checking the toolbar whether it is initialized or not
          if (this.toolbar !== null) {
            this.toolbar.deactivate();
            this.toolbar = null;
          }
        }
      }
    },

    /**
    *This function will enable or disable result panel.
    *@param{boolean} isShowResultPanel: Boolean to check whether result panel should display or not.
    **/
    _showResultPanel: function (isShowResultPanel, paramName,
      featureLength) {
      var exportToCSVArray;
      exportToCSVArray = [];
      if (isShowResultPanel) {
        this._tabContainer.selectTab(this.nls.outputTabTitle);
      }
      this.resultPanel.style.display = isShowResultPanel ? "block" :
        "none";
      array.forEach(this.config.geoprocessing.outputs, function (
        output) {
        if (output.exportToCSV) {
          exportToCSVArray.push(output.paramName);
        }
      });
      //checking export to csv and save to layer array length to display buttons.
      if (exportToCSVArray.length > 0) {
        this.btnExportToLayer.style.display = "block";
        this.btnExportToLayer.title = this.nls.ExportToCSVtooltip;
      } else {
        this.btnExportToLayer.style.display = "none";
      }
      // Checking for param name
      if (paramName) {
        // Looping for output param for enabling and disabling of save to layer button
        array.forEach(this.config.geoprocessing.outputs, lang.hitch(
          this,
          function (output) {
            // Checking for output param name and save to layer with the feature length if all true then enable the save to layer button
            if (paramName === output.paramName && output.saveToLayer !==
              "" && featureLength > 0) {
              this.btnSaveToLayer.style.display = "block";
              this.btnSaveToLayer.title = this.nls.saveToLayertoolTip;
            }
          }));
      }
      if ((this.btnExportToLayer.style.display === "none" || this.btnExportToLayer
          .style.display === "") && (this.btnSaveToLayer.style.display ===
          "none" || this.btnSaveToLayer.style.display === "")) {
        style.set(this.resultPanel, "display", "none");
      }
    },

    /**
    *This function will enable or disable  panel.
    *@param{boolean} isShowTracePanel: Boolean to check whether result panel should display or not.
    **/
    _showTracePanel: function (isShowTracePanel) {
      this.tracePanel.style.display = isShowTracePanel ? "block" :
        "none";
    },

    /**
    *This function will enable or disable 'Save To Layer' and 'Export To CSV' buttons  panel.
    *@param{boolean} isShowButtons: Boolean to check whether result panel should display or not.
    **/
    _showButtons: function (isShowButtons) {
      this.divForButtons.style.display = isShowButtons ? "block" :
        "none";
    },

    /**
    *This function will enable loading icon
    *@param{boolean} isShowLoadingIcon: Boolean to check whether loading icon should display or not.
    **/
    _showLoadingIcon: function (isShowLoadingIcon) {
      var widgetPanel;
      widgetPanel = query(".jimu-widget-frame.jimu-container")[0];
      if (!widgetPanel) {
        widgetPanel = query(".jimu-container")[0];
      }
      if (isShowLoadingIcon) {
        domClass.remove(this.loadingIcon, "runIconidle");
        domClass.add(this.loadingIcon, "runIconProcessing");
        domClass.add(widgetPanel, "esriCTDisableScroll");
      } else {
        domClass.remove(this.loadingIcon, "runIconProcessing");
        domClass.add(this.loadingIcon, "runIconidle");
        domClass.remove(widgetPanel, "esriCTDisableScroll");
      }
    },

    /**
    *This function will execute when user clicked on the 'Run Trace' button.
    **/
    _onTraceButtonClick: function () {
      var resultMainDiv, i, tracePanelHeight,
        inputBarrierTabContentHeight, loadingIconHeight, widgetPanel;
      // if application is running on desktop browsers
      if (!window.appInfo.isRunInMobile) {
        style.set(this.loadingIcon, "height", "0px");
        tracePanelHeight = style.get(this.tracePanel, "height");
        inputBarrierTabContentHeight = style.get(this.InputBarrierTabContent,
          "height");
        loadingIconHeight = tracePanelHeight +
          inputBarrierTabContentHeight + 35;
        if (has("ie")) {
          loadingIconHeight = loadingIconHeight + 40;
        } else if (document && document.documentMode) {
          loadingIconHeight = loadingIconHeight + 40;
        }
        loadingIconHeight = loadingIconHeight.toString() + "px";
      } else {
        // else in mobile do scroll top and show loading indicator
        widgetPanel = query(".jimu-widget-frame.jimu-container")[0];
        if (!widgetPanel) {
          widgetPanel = query(".jimu-container")[0];
        }
        if (widgetPanel) {
          loadingIconHeight = style.getComputedStyle(widgetPanel).height;
          widgetPanel.scrollTop = 0;
        }
      }
      style.set(this.loadingIcon, "height", loadingIconHeight);
      if (!domClass.contains(this.btnTrace, "jimu-state-disabled")) {
        this._outputResultArr = [];
        this._outputResultCount = 0;
        this.savedLayers.length = 0;
        this.savedLayers = [];
        this.overviewFeature = null;
        this.savedFeatureObjectId = null;
        domConstruct.empty(this.outageAreaSelectDiv);
        domConstruct.empty(this.resultLayersInformationContainer);
        resultMainDiv = query(".esriCTResultContainerData");
        for (i = 0; i < resultMainDiv.length; i++) {
          domConstruct.empty(resultMainDiv[i]);
        }
        this.enableWebMapPopup();
        this._GPExecute();
        this._showTracePanel(true);
        this._showLoadingIcon(true);
        this._showResultPanel(false);
        style.set(this.resultLayersInformationContainer, "display",
          "block");
        style.set(this.resultsLayerNamesContainer, "display", "block");
      }
    },

    /**
    *This function will execute when user clicked on the 'Save To Layer' button.
    **/
    _onSaveToLayerButtonClick: function () {
      if (!domClass.contains(this.btnSaveToLayer,
          "jimu-state-disabled")) {
        this._checkTargetLayersAvailability();
        this._showResultPanel(false);
        style.set(this.resultLayersInformationContainer, "display",
          "none");
        style.set(this.resultsLayerNamesContainer, "display", "none");
        this._tabContainer.controlNode.style.display = "none";
        style.set(this.resultPanel, "display", "none");
        this.SaveToLayerPanel.style.display = "block";
        this.saveToLayerDiv.style.display = "block";
        this.exportToCSVPanel.style.display = "none";
        this._displaySaveLayerPanel();
        this._overviewLayerSave();
        this._displayOutageAreaDetail();
        if (this.btnSave) {
          domClass.add(this.btnSave, "esriCTCentralisedSaveButton");
        }
        // if selected theme is Dart Theme and browser is IE9
        if (this.appConfig.theme.name === "DartTheme" && has("ie") ===
          9) {
          this._setDartBackgroudColorForIE9();
        }
        if (this.appConfig.theme.name === "DartTheme") {
          this._modifyDatePickerButtonNodeContent();
        }
      }
    },

    /**
    *This function will check the availability of target layers.
    **/
    _checkTargetLayersAvailability: function () {
      var unavailableLayers = [],
        errorMessage, layerObj;
      if (this.config.overview.saveToLayer !== "" && !this.map.getLayer(
          this.config.overview.saveToLayer)) {
        unavailableLayers.push(this.nls.outageAreaLabel);
      }
      array.forEach(this.config.geoprocessing.outputs, lang.hitch(
        this,
        function (output) {
          if (output.saveToLayer && output.saveToLayer !== "") {
            layerObj = this.map.getLayer(output.saveToLayer);
            if (!layerObj) {
              unavailableLayers.push(output.paramName);
            }
          }
        }));

      if (unavailableLayers.length > 0) {
        errorMessage = string.substitute(this.nls.unavailableLayersError, [
          unavailableLayers.join(", ")
        ]);
        this._errorMessage(errorMessage);
      }
    },

    /**
    * This function will save the overview layer.
    **/
    _overviewLayerSave: function () {
      var j, layerObject, arraynumberTextboxValue = [],
        value, featureLengthAttr = {},
        k, overviewGraphic, featureLayerQuery;
      if (this.config.overview.saveToLayer !== "") {
        layerObject = this.map.getLayer(this.config.overview.saveToLayer);
        if (layerObject && this.overviewGraphicsLayer.graphics.length ===
          1 && !this.overviewFeature) {
          featureLayerQuery = new Query();
          featureLayerQuery.objectIds = [this.overviewGraphicsLayer.graphics[
            0].attributes[this.overviewGraphicsLayer.objectIdField]];
          this.overviewGraphicsLayer.selectFeatures(featureLayerQuery,
            layerObject.SELECTION_NEW, lang.hitch(this, function (
              features) {
              overviewGraphic = features[0];
            }));
          // Looping for getting layer's id and feature length
          array.forEach(this.config.geoprocessing.outputs, lang.hitch(
            this,
            function (output) {
              // Created an object and inserting id of the layer and length of the feature.
              featureLengthAttr = {};
              featureLengthAttr.id = output.layer.id;
              featureLengthAttr.value = output.results.features.length;
              // Pushing object in an array to access it outside
              arraynumberTextboxValue.push(featureLengthAttr);
            }));

          // Looping for fieldmap to get number of feature length
          for (j = 0; j < this.config.overview.fieldMap.length; j++) {
            value = 0;
            if (this.config.overview.fieldMap[j].type === "count") {
              // Looping for array number text box to get matched value from the layer.
              for (k = 0; k < arraynumberTextboxValue.length; k++) {
                // Checking if param name is equal to the layers id
                if (this.config.overview.fieldMap[j].paramName ===
                  arraynumberTextboxValue[k].id) {
                  value = arraynumberTextboxValue[k].value;
                  break;
                }
              }
            }
            else if (this.config.overview.fieldMap[j].type === "value") {
              for (key in this.outputStrings) {
                if (key === this.config.overview.fieldMap[j].paramName) {
                  value = this.outputStrings[key];
                  break;
                }
              }
            }
            // Setting the attribute value
            overviewGraphic.attributes[this.config.overview.fieldMap[
              j].fieldName] = value;
          }
          // Refreshing the attribute inspector
          this.attInspector.refresh();
        }
      }
    },

    /**
    *This Function will display Runtrace panel when click on back button .
    **/
    _onBackButtonClick: function () {
      if (this.CheckBoxOutageArea) {
        this.CheckBoxOutageArea.checked = false;
      }
      domClass.add(this.outageAreaVisibiltyDiv, "esriCTHidden");
      this._showLoadingIcon(true);
      this._showResultPanel(true);
      this._showLoadingIcon(false);
      this.SaveToLayerPanel.style.display = "none";
      this.exportToCSVPanel.style.display = "none";
      style.set(this.resultLayersInformationContainer, "display",
        "block");
      style.set(this.resultsLayerNamesContainer, "display", "block");
      this._tabContainer.controlNode.style.display = "block";
      if ((this.btnExportToLayer.style.display === "none" || this.btnExportToLayer
          .style.display === "") && (this.btnSaveToLayer.style.display ===
          "none" || this.btnSaveToLayer.style.display === "")) {
        style.set(this.resultPanel, "display", "none");
      } else {
        style.set(this.resultPanel, "display", "block");
      }
    },

    /**
    *This Function will display Runtrace panel when click on back button.
    **/
    _onExportToLayerButtonClick: function () {
      if (!domClass.contains(this.btnExportToLayer,
          "jimu-state-disabled")) {
        this._showResultPanel(false);
        this._showLoadingIcon(false);
        this.SaveToLayerPanel.style.display = "none";
        this.exportToCSVPanel.style.display = "block";
        style.set(this.resultLayersInformationContainer, "display",
          "none");
        style.set(this.resultsLayerNamesContainer, "display", "none");
        this._tabContainer.controlNode.style.display = "none";
        style.set(this.resultPanel, "display", "none");
        style.set(this.exportToCSVDiv, "display", "block");
        this._displayExportToCSVPanel();
      }
    },

    _scrubBlankDateFields: function (fields, features) {
      var dateFields = [];
      array.forEach(fields, function (field) {
        if (field.type === "esriFieldTypeDate")
          dateFields.push(field.name);
      });
      array.forEach(features, function (feature) {
        array.forEach(dateFields, function (dateField) {
          if (feature.attributes.hasOwnProperty(dateField)) {
            if (feature.attributes[dateField] === "")
              delete feature.attributes[dateField];
          }
        });
      });
    },
    _onSelectAllCSV: function () {
      array.forEach(this.checkBoxCSV, function (checkBox) {
        //checkBox.setValue(true);
        checkBox.check();
      });


    },
    _onSelectAll: function () {
      array.forEach(this.saveCheckBoxs, function (checkBox) {
        //checkBox.setValue(true);
        checkBox.check();
      });
      this._displayOutageAreaDetail();

    },

    /**
    *This Function is used to save layer which type is result.
    **/
    _onSaveClick: function () {
      var i, overviewGraphic, checkBox, selectedLayersArray = [],
        isOverViewAreaEdited = false,
        errorMessage, layerObj, layerObject, deferredArray = [],
        unavailableLayerNames = [],
        displayName;
      this._showLoadingIcon(true);
      checkBox = query(".saveToLayerData", this.bottomDiv);
      for (i = 0; i < checkBox.length; i++) {
        if (domClass.contains(checkBox[i].firstChild, "checked")) {
          displayName = domAttr.get(checkBox[i], "OBJID");
          if (displayName !== null) {
            selectedLayersArray.push(displayName);
          }
        }
      }
      // Checking if over viwe area is not added to map
      if (!this.overviewFeature) {
        layerObject = this.map.getLayer(this.config.overview.saveToLayer);
        // If the selected array and the over view graphics layer has some value then do apply edit(add)
        if (this.overviewGraphicsLayer.graphics.length === 1 && array
          .indexOf(selectedLayersArray, "Overview") > -1) {
          if (layerObject) {
            overviewGraphic = new Graphic(this.overviewGraphicsLayer.graphics[
              0].geometry, null, this.overviewGraphicsLayer.graphics[
              0].attributes);
            overviewGraphic.attributes[this.overviewGraphicsLayer.objectIdField] =
              null;
            deferredArray.push(layerObject.applyEdits([
              overviewGraphic
            ], null, null, lang.hitch(this, function (evt) {
              if (evt && evt.length > 0 && evt[0].success) {
                isOverViewAreaEdited = true;
                this.overviewFeature = overviewGraphic;
                this.savedFeatureObjectId = evt[0].objectId;
                layerObject.refresh();
              }
            }), this._applyEditsErrorCallback));

          } else {
            unavailableLayerNames.push(this.nls.outageAreaLabel);
          }
        }
        // When overview  feature is created
      } else {
        layerObject = this.map.getLayer(this.config.overview.saveToLayer);
        // If the selected array and the over view graphics layer has some value then do apply edit(Edit)
        if (layerObject && this.overviewGraphicsLayer.graphics.length ===
          1 && array.indexOf(selectedLayersArray, "Overview") > -1) {
          overviewGraphic = new Graphic(this.overviewGraphicsLayer.graphics[
            0].geometry, null, this.overviewGraphicsLayer.graphics[
            0].attributes);
          overviewGraphic.attributes[this.overviewGraphicsLayer.objectIdField] =
            this.savedFeatureObjectId;
          deferredArray.push(layerObject.applyEdits(null, [
            overviewGraphic
          ], null, lang.hitch(this, function () {
            isOverViewAreaEdited = true;
            layerObject.refresh();
          }), this._applyEditsErrorCallback));
        }
      }
      //  Fire apply edit to other save to layer feature
      array.forEach(this.config.geoprocessing.outputs, lang.hitch(
        this,
        function (output) {
          if (array.indexOf(this.savedLayers, output.paramName) <
            0 && array.indexOf(selectedLayersArray, output.paramName) >
            -1 && output.saveToLayer !== "" && output.results !==
            null && output.results.features !== null && output.results
            .features.length > 0) {
            layerObj = this.map.getLayer(output.saveToLayer);
            if (layerObj) {
              this.savedLayers.push(output.paramName);
              this._scrubBlankDateFields(layerObj.fields, output.results
                .features);
              deferredArray.push(layerObj.applyEdits(output.results
                .features, null, null, null, this._applyEditsErrorCallback
              ));
            } else {
              unavailableLayerNames.push(output.paramName);
            }
          }
        }));
      // Check if deferred array has items
      if (deferredArray.length > 0) {
        all(deferredArray).then(lang.hitch(this, function (result) {
          // Cheching if apply edits fals then show proper message
          if ((result && result.length > 0 && result[0] &&
              result[0].length > 0 && result[0][0].error) || (
              array.indexOf(selectedLayersArray, "Overview") >
              -1 && result.length === 0)) {
            this._errorMessage(this.nls.unableToSaveLayer);
            this._showLoadingIcon(false);
            // Checking if over view area is saveed
          } else if (this.errorLayerArray.length === 0 &&
            selectedLayersArray.length > 0 &&
            isOverViewAreaEdited) {
            this._errorMessage(this.nls.saveToLayerSuccess);
            this._onBackButtonClick();
            this._showLoadingIcon(false);
            //  Checking if layer is saved and not the over view area
          } else if (this.errorLayerArray.length === 0 &&
            selectedLayersArray.length > 0 && result && result.length >
            0 && result[0] && result[0].length > 0 && !
            isOverViewAreaEdited) {
            this._errorMessage(this.nls.saveToLayerSuccess);
            this._onBackButtonClick();
            this._showLoadingIcon(false);
          } else {
            // If noting is saved then show proper message
            errorMessage = selectedLayersArray.length > 0 ?
              this.nls.noChangeToSave : this.nls.noLayerToSave;
            this._errorMessage(errorMessage);
            this._showLoadingIcon(false);
          }

        }));
        // Show the message when deferred array does not have any element
      } else {
        // Checking for selected layer if greater or less then 0 then show proper message
        if (unavailableLayerNames.length) {
          errorMessage = string.substitute(this.nls.unavailableLayersError, [
            unavailableLayerNames.join(',')
          ]);
        } else {
          errorMessage = selectedLayersArray.length > 0 ? this.nls.noChangeToSave :
            this.nls.noLayerToSave;
        }
        this._errorMessage(errorMessage);
        this._showLoadingIcon(false);
      }
    },

    /**
    * This is error call back function of apply edit method.
    **/
    _applyEditsErrorCallback: function (evt) {
      this.errorLayerArray.push(evt);
    },

    /**
    *This function will execute when User click on 'Export to CSV icon' .
    **/
    _displayExportToCSVPanel: function () {
      this.checkBoxCSV = [];
      var labelText, saveButton, checkboxDiv, btnExportToLayerDiv,
        exportToLayerCheckBox;
      domConstruct.empty(this.exportToCSVBottomDiv);
      domConstruct.empty(this.exportToCSVButtonDiv);
      array.forEach(this.config.geoprocessing.outputs, function (
        output) {
        if (output.exportToCSV) {
          checkboxDiv = domConstruct.create("div", {
            "class": "esriCTParamCheckBox esriCTCommonDiv"
          });
          exportToLayerCheckBox = new Checkbox({
            "name": output.paramName,
            "class": "esriCTChkExportToLayer"
          }, domConstruct.create("div", {}, checkboxDiv));
          this.checkBoxCSV.push(exportToLayerCheckBox);
          exportToLayerCheckBox.title = output.paramName;
          domAttr.set(exportToLayerCheckBox.domNode, "ObJID",
            output.paramName);
          labelText = (output.type === "Overview") ? this.nls.outageAreaLabel :
            output.panelText;
          domConstruct.create("label", {
            "innerHTML": labelText,
            "class": "esriCTChkLabel"
          }, checkboxDiv);
          domConstruct.place(checkboxDiv, this.exportToCSVBottomDiv);
        }
      }, this);
      btnExportToLayerDiv = domConstruct.create("div", {
        "class": "esriCTSaveButton"
      });
      //Save
      saveButton = domConstruct.create("div", {
        "class": "jimu-btn esriCTCentralisedSaveButton",
        "innerHTML": this.nls.btnSaveExportToLayer
      }, btnExportToLayerDiv);
      this.own(on(saveButton, "click", lang.hitch(this, function () {
        var checkBox, arrayValues, i, displayName, j;
        checkBox = query(".esriCTChkExportToLayer", this.exportToCSVBottomDiv);
        arrayValues = [];
        for (i = 0; i < checkBox.length; i++) {
          if (domClass.contains(checkBox[i].firstChild,
              "checked")) {
            displayName = domAttr.get(checkBox[i], "ObJID");
            if (displayName !== null) {
              arrayValues.push(displayName);
            }
          }
        }
        if (arrayValues.length === 0) {
          this._errorMessage(this.nls.noLayerSelectedForExportToCSV);
        } else {
          for (j = 0; j < arrayValues.length; j++) {
            this._initializingExportToCSV(arrayValues[j]);
            if (j === arrayValues.length - 1) {
              this._errorMessage(this.nls.exportToCSVSuccess);
              this._onBackButtonClick();
            }
          }
        }
      })));
      domConstruct.place(btnExportToLayerDiv, this.exportToCSVButtonDiv);
    },

    /**
    * This function will initialize the export to csv process.
    * @param{string}csvFileName: Name of the csv file.
    **/
    _initializingExportToCSV: function (csvFileName) {
      var defs;
      defs = [];
      array.forEach(this.config.geoprocessing.outputs, lang.hitch(
        this,
        function (output) {
          if (csvFileName === output.paramName) {
            defs.push(this._createCSVContent(output.results,
              output.paramName).promise);
          }
        }));
      all(defs).then(lang.hitch(this, function (results) {
        if (results.length !== 0) {
          var TempString;
          array.forEach(results, function (result) {
            TempString = (result.csvdata).split(",");
            lang.hitch(this, this._exportToCSVComplete(
              result, TempString[0], result.orgResults));
          }, this);
        }

      }), lang.hitch(this, function (error) {
        this._errorMessage(error);
        this._onBackButtonClick();
      }));

    },

    /**
    * This function will download the csv file on client side.
    * @param{object}csvdata: object containing information regarding csv data.
    * @param{string}fileName: name of the csv file.
    **/
    _exportToCSVComplete: function (csvdata, fileName, orgData) {
      var link, oWin, click_ev;
      if (this.IsIE) {
        /*
        oWin = window.top.open("about:blank", "_blank");
        oWin.document.write(csvdata.csvdata);
        oWin.document.close();
        oWin.document.execCommand('SaveAs', true, fileName);
        oWin.close();
        */
        var ds = exportUtils.createDataSource({
          type: exportUtils.TYPE_FEATURESET,
          filename: fileName,
          data: utils.toFeatureSet(orgData.features)
        });

        ds.setFormat(exportUtils.FORMAT_CSV);
        ds.download();
      } else {
        link = domConstruct.create("a", {
          href: 'data:attachment/csv;charset=utf-8,' +
            encodeURIComponent(csvdata.csvdata),
          target: '_blank',
          download: fileName + ".csv"
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
    },

    /**
    * This function is used to create CSV content data.
    **/
    _createCSVContent: function (results, title) {
      var deferred, csvNewLineChar, csvContent, atts, dateFlds, idx,
        dataLine, i;
      deferred = new Deferred();
      atts = [];
      dateFlds = [];
      idx = 0;
      setTimeout(lang.hitch(this, function () {
        var key;
        csvNewLineChar = "\r\n";
        csvContent = title + "," + csvNewLineChar;
        if (results.features.length > 0) {
          for (key in results.features[0].attributes) {
            if (results.features[0].attributes.hasOwnProperty(
                key)) {
              for (i = 0; i < results.fields.length; i++) {
                if (results.fields[i].name === key) {
                  if (results.fields[i].type ===
                    "esriFieldTypeDate") {
                    dateFlds.push(idx);
                  }
                  idx += 1;
                  atts.push(results.fields[i].alias);
                }
              }
            }
          }
          csvContent += atts.join(",") + csvNewLineChar;
          array.forEach(results.features, function (feature) {
            atts = [];
            idx = 0;
            var k;
            if (feature.attributes !== null) {
              for (k in feature.attributes) {
                if (feature.attributes.hasOwnProperty(k)) {
                  if (dateFlds.indexOf(idx) >= 0) {
                    atts.push("\"" + feature.attributes[k] +
                      "\"");
                  } else {
                    atts.push("\"" + feature.attributes[k] +
                      "\"");
                  }
                  idx = idx + 1;
                }
              }
            }
            dataLine = atts.join(",");
            csvContent += dataLine + csvNewLineChar;
          }, this);
          csvContent += csvNewLineChar + csvNewLineChar;
        } else {
          array.forEach(results.fields, function (field) {
            atts.push(field.alias);
          }, this);
          csvContent += atts.join(",") + csvNewLineChar;
        }
        deferred.resolve({
          "csvdata": csvContent,
          "orgResults": results
        });
      }, 1000));
      return deferred;
    },

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
    *This function is used to display 'Save to Layer' panel.
    **/
    _displaySaveLayerPanel: function () {
      this.saveCheckBoxs = [];

      var otherLayercheckBox, checkboxDiv, overviewLayerFields,
        overviewLayerInfos;
      domConstruct.empty(this.outageCheckBoxDiv);
      domConstruct.empty(this.chkLayerDiv);
      domConstruct.empty(this.resultParametersCount);
      query(".clearInstance").forEach(domConstruct.destroy);
      if (this.config.overview.saveToLayer !== "") {
        this.outageDetailDiv = domConstruct.create("div", {
          "class": "clearInstance"
        }, this.outageCheckBoxDiv);
        this.outageAreaDiv = domConstruct.create("div", {
          "class": "clearInstance"
        }, this.outageDetailDiv);
        this.CheckBoxOutageArea = new Checkbox({
          "name": this.config.overview.type,
          "class": "clearInstance saveToLayerData",
          "style": "float: left;"
        }, this.outageAreaDiv);
        this.saveCheckBoxs.push(this.CheckBoxOutageArea);
        this.CheckBoxOutageArea.title = this.nls.outageAreaLabel;
        domConstruct.create("label", {
          "innerHTML": this.nls.outageAreaLabel,
          "class": "esriCTLabelMargin"
        }, this.outageDetailDiv);
        this.own(on(this.CheckBoxOutageArea.domNode, "click", lang.hitch(
          this,
          this._displayOutageAreaDetail)));
        domAttr.set(this.CheckBoxOutageArea.domNode, "OBJID", this.config
          .overview.type);
        if (this.outageAreaSelectDiv.children.length === 0) {
          if (this.attInspector) {
            this.attInspector.destroy();
          }
          this.attInspector = null;
          overviewLayerFields = this.layerFieldsToFieldInfos(this.config
            .overview.saveToLayer);
          overviewLayerInfos = [{
            'featureLayer': this.overviewGraphicsLayer,
            'showAttachments': false,
            'isEditable': true,
            'fieldInfos': overviewLayerFields
          }];
          this.attInspector = new AttributeInspector({
            layerInfos: overviewLayerInfos
          }, domConstruct.create("div", {}, this.outageAreaSelectDiv));
          this.attInspector.startup();
          this.attInspector.on("attribute-change", lang.hitch(this,
            function (evt) {
              if (this.overviewGraphicsLayer.graphics.length > 0) {
                this.overviewGraphicsLayer.graphics[0].attributes[
                  evt.fieldName] = evt.fieldValue;
              }
            }));
        }
      }

      array.forEach(this.config.geoprocessing.outputs, lang.hitch(
        this,
        function (output) {
          if (output.results.features.length > 0 && output.saveToLayer !==
            "") {
            checkboxDiv = domConstruct.create("div", {
              "class": "esriCTParamCheckBox esriCTCommonDiv"
            });

            otherLayercheckBox = new Checkbox({
              "name": output.paramName,
              "class": "saveToLayerData",
              "style": "float: left;"
            }, domConstruct.create("div", {}, checkboxDiv));
            this.saveCheckBoxs.push(otherLayercheckBox);
            domConstruct.create("label", {
              "class": "esriCTChkLabel",
              "innerHTML": output.panelText
            }, checkboxDiv);
            domConstruct.place(checkboxDiv, this.chkLayerDiv);
            domAttr.set(otherLayercheckBox.domNode, "OBJID",
              output.paramName);
          }
        }));
    },

    layerFieldsToFieldInfos: function (layerName) {
      var fieldInfo = null,
        layer = null,
        overviewFieldInfo = [];
      array.some(this.map.webMapResponse.itemInfo.itemData.operationalLayers,
        lang.hitch(this, function (layer) {
          if (layer.id === layerName) {
            overviewFieldInfo = layer.popupInfo.fieldInfos;
            return true;
          }
        }));

      if (overviewFieldInfo !== null) {
        array.forEach(overviewFieldInfo, function (fieldInfo) {
          if (fieldInfo && fieldInfo.format && fieldInfo.format !==
            null) {
            if (fieldInfo.format.dateFormat && fieldInfo.format.dateFormat !==
              null) {
              if (fieldInfo.format.dateFormat ===
                "shortDateShortTime" ||
                fieldInfo.format.dateFormat ===
                "shortDateLongTime" ||
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
        fieldInfo = overviewFieldInfo;
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

      return array.filter(fieldInfo, function (field) {
        return field.visible;
      });
    },

    /**
    * This function will create field info for Overview Layer
    * @param{array} fields
    **/
    _filterOverviewLayerFieldInfo: function (fields) {
      var i, overviewFieldInfo = [];
      for (i = 0; i < fields.length; i++) {
        if (fields[i].isEditable) {
          overviewFieldInfo.push(fields[i]);
        }
      }
      return overviewFieldInfo;
    },

    /**
    * This function destroy widget if created
    * @param{object} div
    */
    _destroyWidget: function (div) {
      var widgets = registry.findWidgets(div);
      domConstruct.empty(div);
      // Looping for each widget and destroying the widget
      array.forEach(widgets, function (w) {
        w.destroyRecursive(true);
      });
    },

    /**
    *This function is used to display (Outage Date,time,Type) panel.
    **/
    _displayOutageAreaDetail: function () {
      if (this.CheckBoxOutageArea && this.CheckBoxOutageArea.checked) {
        domClass.remove(this.outageAreaVisibiltyDiv, "esriCTHidden");
        this._enhanceLaunchpadThemeStyle();
      } else {
        domClass.add(this.outageAreaVisibiltyDiv, "esriCTHidden");
      }
    },

    /**
    * This function will enable the web map popup.
    **/
    enableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(true);
      }
    },

    /**
    * This function will disable the web map popup.
    **/
    disableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(false);
      }
    },

    /**
    *This function will execute when user clicked on the map and it will add the graphic to the input graphic layer.
    *@param{object} evt: object containing information regarding the map point.
    **/
    _onMapClick: function (evt) {
      var addType, objID;
      //This is will check whether Flag or Barrier has been selected or not, to place the pushpin on the map.
      if (this.flagBtnClicked || this.barrierBtnClicked) {
        //Checking whether flag button is clicked or not.
        if (this.flagBtnClicked) {
          addType = "Flag";
          domClass.remove(this.btnTrace, "jimu-state-disabled");
          this.btnTrace.disabled = false;
          this._flagID++;
          objID = this._flagID;
          this._addInputLocation(new Graphic(evt.mapPoint, null, {
            "ObjID": objID
          }, null), addType);
        }
        //checking whether barrier button is clicked or not.
        if (this.barrierBtnClicked) {
          addType = "Barrier";
          this._barrierID++;
          objID = this._barrierID;
          this._addBarrierLocation(new Graphic(evt.mapPoint, null, {
            "ObjID": objID
          }, null), addType);
        }
        //Looping thorugh the Input Layers to add the Graphic.
        array.some(this.gpInputDetails, function (layer) {
          //Checking the Layer type
          if (layer.type === addType) {
            layer.add(new Graphic(evt.mapPoint, null, {
              "ObjID": objID
            }, null));
            return true;
          }
        });
      }
    },

    /**
    *This function will return the symbol as per the provided JSON.
    *@param{object} json: The JSON object from which symbol will be returned.
    *@return{object} symbol:Symbol can be simplefillsymbol, simplemarkersymbol, simplelinesymbol or picturemarkersymbol.
    **/
    _createGraphicFromJSON: function (json) {
      var symbol;
      symbol = symbolJsonUtils.fromJson(json);
      return symbol;
    },

    /**
    *This function will add the Input layers into the map.
    **/
    _createGraphic: function () {
      this.gpInputDetails = [];
      this.skipLayer = null;
      var inLayer, addSymbol, ren, barriersFlag;
      barriersFlag = query(".btnBarrierStyle", this.tracePanel)[0];
      //This will create the GraphicsLayer as per the GP Inputs.
      array.forEach(this.config.geoprocessing.inputs, function (input) {
        inLayer = new GraphicsLayer();
        inLayer.id = input.paramName;
        inLayer.type = input.type;
        inLayer.paramName = input.paramName;
        addSymbol = this._createGraphicFromJSON(input.symbol);
        ren = new SimpleRenderer(addSymbol);
        inLayer.setRenderer(ren);
        this.gpInputDetails.push(inLayer);
        //checking input type
        if (input.type === "Skip") {
          this.skipLayer = inLayer;
        }
        if (input.type === "Barrier") {
          domClass.remove(barriersFlag, "esriCTHidden");
          if (input.toolTip !== "" || input.toolTip !== null) {
            this.btnBarrier.title = input.toolTip;
          }
          this.barrierLabel.innerHTML = input.displayName;
        }
        if (input.type === "Flag") {
          if (input.toolTip !== "" || input.toolTip !== null) {
            this.btnFlag.title = input.toolTip;
          }
          this.flagLabel.innerHTML = input.displayName;
        }
      }, this);
      this.map.addLayers(this.gpInputDetails);
    },

    /**
    *This Function will add the output layers to the map also initialize TitlePane into the Widget.
    **/
    _createResultPanels: function () {
      var rendererObj, symbolObj, featureCollection = {},
        outFields, overviewLayer, sym, ren, layer;
      symbolObj = this._createGraphicFromJSON(this.config.overview.symbol);
      rendererObj = new SimpleRenderer(symbolObj);
      if (this.config.overview.saveToLayer !== "") {
        overviewLayer = this.map.getLayer(this.config.overview.saveToLayer);
        if (overviewLayer) {
          outFields = array.map(overviewLayer.fields, function (field) {
            return field.name;
          });
        }
      }
      featureCollection.layerDefinition = {
        "id": 0,
        "name": this.name + " Overview",
        "type": "Feature Layer",
        "displayField": overviewLayer ? overviewLayer.displayField : "",
        "description": "",
        "copyrightText": "",
        "relationships": [],
        "geometryType": overviewLayer ? overviewLayer.geometryType : "",
        "minScale": 0,
        "maxScale": 0,
        "extent": overviewLayer ? overviewLayer.fullExtent : "",
        "drawingInfo": {
          "renderer": rendererObj,
          "transparency": 0,
          "labelingInfo": null
        },
        "hasAttachments": true,
        "htmlPopupType": "esriServerHTMLPopupTypeAsHTMLText",
        "objectIdField": overviewLayer ? overviewLayer.objectIdField : "",
        "globalIdField": overviewLayer ? overviewLayer.globalIdField : "",
        "typeIdField": overviewLayer ? overviewLayer.typeIdField : "",
        "fields": overviewLayer ? overviewLayer.fields : "",
        "types": overviewLayer ? overviewLayer.types : "",
        "templates": overviewLayer ? overviewLayer.templates : "",
        "capabilities": "Query,Editing"
      };
      this.overviewGraphicsLayer = new FeatureLayer(featureCollection, {
        outFields: outFields && outFields.length > 0 ? outFields : []
      });
      this.overviewGraphicsLayer.visible = this.config.overview.visibility;
      this.overviewGraphicsLayer.renderer = rendererObj;
      this.map.addLayer(this.overviewGraphicsLayer);

      this.resultLayers = [];
      domConstruct.empty(this.resultLayersInformationContainer);
      array.forEach(this.config.geoprocessing.outputs, function (
        output) {
        sym = null;
        ren = null;
        layer = new GraphicsLayer();
        if (isNaN(output.MinScale) && isNaN(output.MaxScale)) {
          layer.minScale = Number(output.MinScale.replace(",", ""));
          layer.maxScale = Number(output.MaxScale.replace(",", ""));
        } else {
          layer.minScale = output.MinScale;
          layer.maxScale = output.MaxScale;
        }

        //To check whether output layer is visible or not.
        if (output.hasOwnProperty("visible")) {
          if (output.visible !== null) {
            if (output.visible) {
              layer.setVisibility(true);
            } else {
              layer.setVisibility(false);
            }
          } else {
            layer.setVisibility(true);
          }
        }
        layer.id = output.paramName;
        //To check whether output contains symbol or not.
        if (output.symbol !== null) {
          sym = this._createGraphicFromJSON(output.symbol);
          ren = new SimpleRenderer(sym);
          layer.setRenderer(ren);
        }
        this.map.addLayer(layer);
        output.layer = layer;
        if (this.config.geoprocessing.outputs.length > 0) {
          this._createLayerResultPanel(output);
        }
        //To check whether output type is overview.
        if (output.type === "Result") {
          this.resultLayers.push(layer);
        } else {
          this.overviewInfo = output;
        }
      }, this);
    },

    _createLayerResultPanel: function (output) {
      var layerNameContainer, layerName, rightCaretIcon,
        resultContainer,
        resultContainerHeader, resultContainerBack,
        resultContainerLbl, resultContainerData;
      layerNameContainer = domConstruct.create("div", {
        "class": "esriCTLayerNameContainer",
        "LayerName": output.paramName
      });
      layerName = domConstruct.create("div", {
        "class": "esriCTLayerName",
        "innerHTML": output.panelText,
        "id": output.paramName + "_LN"
      }, layerNameContainer);
      rightCaretIcon = domConstruct.create("div", {
        "class": "esriCTRightCaretIcon"
      }, layerNameContainer);
      this.resultsLayerNamesContainer.appendChild(
        layerNameContainer);

      resultContainer = domConstruct.create("div", {
        "class": "esriCTResultContainer",
        "id": output.paramName + "RC",
        "title": ""
      });
      resultContainerHeader = domConstruct.create("div", {
        "class": "esriCTResultContainerHeader",
        "resultType": output.paramName,
        "title": ""
      }, resultContainer);
      resultContainerBack = domConstruct.create("div", {
        "class": "esriCTResultContainerBack",
        "resultType": output.paramName,
        "innerHTML": "&lt;" + this.nls.backButtonValue,
        "title": ""
      }, resultContainerHeader);
      resultContainerLbl = domConstruct.create("div", {
        "class": "esriCTResultContainerLbl",
        "id": output.paramName + "_RCL",
        "title": ""
      }, resultContainerHeader);
      resultContainerData = domConstruct.create("div", {
        "class": "esriCTResultContainerData",
        "id": output.paramName + "RCD",
        "title": ""
      }, resultContainer);
      this.layerFeaturesContainer.appendChild(
        resultContainer);
      this._displayFeatureOnLayerClick(layerNameContainer,
        resultContainerBack);
    },

    _displayFeatureOnLayerClick: function (layerNameContainer,
      resultContainerBack) {
      var paramName, resultMainDiv, resultDataDiv;
      this.own(on(layerNameContainer, "click", lang.hitch(this,
        function (evt) {
          paramName = domAttr.get(evt.currentTarget,
            "LayerName");
          resultDataDiv = dom.byId(paramName + "RCD");
          if (resultDataDiv.children.length !== 0) {
            resultMainDiv = dom.byId(paramName + "RC");
            style.set(resultMainDiv, "display", "block");
            style.set(this.resultLayersInformationContainer,
              "display", "none");
            style.set(this.resultsLayerNamesContainer,
              "display", "none");
            this._tabContainer.controlNode.style.display =
              "none";
            style.set(this.resultPanel, "display", "none");
          }
        })));
      this.own(on(resultContainerBack, "click", lang.hitch(this,
        function (evt) {
          paramName = domAttr.get(evt.currentTarget,
            "resultType");
          resultMainDiv = dom.byId(paramName + "RC");
          style.set(resultMainDiv, "display", "none");
          this._tabContainer.controlNode.style.display =
            "block";
          style.set(this.resultLayersInformationContainer,
            "display", "block");
          style.set(this.resultsLayerNamesContainer, "display",
            "block");
          style.set(this.resultPanel, "display", "block");
          if (this.resultLayersInformationContainer.innerHTML !==
            "") {
            domClass.remove(this.headPaneTitle,
              "esriCTBorderNone");
          }
        })));
    },

    /**
    *This function will execute when User clicked on 'Clear' button.
    **/
    _onClearButtonClick: function () {
      this._clearResults();
      if (this.appConfig.theme.name === "DartTheme") {
        style.set(this.InputBarrierTabContent, "display", "none");
      }
    },

    /**
    *This function will Clear all the results and resets all buttons.
    **/
    _clearResults: function () {
      var resultMainDiv, i;
      if (this.overviewGraphicsLayer) {
        this.overviewGraphicsLayer.clear();
      }
      style.set(this.barrierLocTab, "display", "none");
      style.set(this.inputLocTab, "display", "none");
      style.set(this.InputBarrierTabContent, "display", "none");
      domConstruct.empty(this.flagLocContent);
      domConstruct.empty(this.barrierLocContent);
      this._flagID = this._barrierID = this._flagCount = this._barrierCount =
        0;
      this._inputFlag = this._inputBlock = 0;

      style.set(this.resultLayersInformationContainer, "display",
        "none");
      style.set(this.resultsLayerNamesContainer, "display", "none");
      domConstruct.empty(this.resultLayersInformationContainer);
      resultMainDiv = query(".esriCTResultContainerData");
      for (i = 0; i < resultMainDiv.length; i++) {
        domConstruct.empty(resultMainDiv[i]);
      }
      this._showResultPanel(false);
      this._resetInputs();
      this._resetResults();
      if (this.toolbar !== null) {
        this.toolbar.deactivate();
        this.toolbar = null;
      }
      //This will check the Flag Status and as per that change the state of the button
      if (this.flagBtnClicked) {
        this.flagBtnClicked = false;
        domClass.remove(this.btnFlag, "flagButtonselected");
        domClass.add(this.btnFlag, "flagbutton");
      }
      //This will check the Barrier Status and as per that change the state of the button
      if (this.barrierBtnClicked) {
        this.barrierBtnClicked = false;
        domClass.remove(this.btnBarrier, "barrierButtonselected");
        domClass.add(this.btnBarrier, "barrierButton");
      }
      if (this.btnFlag.className.indexOf("traceControlDisabledDiv") >
        -1) {
        domClass.remove(this.btnFlag, "traceControlDisabledDiv");
      }
      if (this.btnBarrier.className.indexOf("traceControlDisabledDiv") >
        -1) {
        domClass.remove(this.btnBarrier, "traceControlDisabledDiv");
      }
      this.savedLayers.length = 0;
      this.savedLayers = [];
      domConstruct.empty(this.outageAreaSelectDiv);
      this.overviewFeature = null;
      if (this.attInspector) {
        this.attInspector.destroy();
      }
      this.attInspector = null;
      this.btnFlag.disabled = false;
      this.btnBarrier.disabled = false;
      domClass.add(this.btnTrace, "jimu-state-disabled");
      this.btnTrace.disabled = true;
      domClass.add(this.btnSaveToLayer, "jimu-state-disabled");
      domClass.add(this.btnExportToLayer, "jimu-state-disabled");
    },

    /**
    *This function removes all graphic layers from map.
    **/
    _removeAllGraphicLayers: function () {
      this._removeInputGraphics();
      this._removeResultGraphics();
    },

    /**
    *This function removes all results graphic layers from map.
    **/
    _removeResultGraphics: function () {
      array.forEach(this.resultLayers, lang.hitch(this, function (item) {
        this.map.removeLayer(item);
      }));
      if (this.overviewInfo && this.overviewInfo.layer) {
        this.map.removeLayer(this.overviewInfo.layer);
      }
      if (this.overviewGraphicsLayer) {
        this.map.removeLayer(this.overviewGraphicsLayer);
      }
      if (this.animatedLayer) {
        this.map.removeLayer(this.animatedLayer);
      }
    },

    /**
    *This function removes all input graphic layers from map.
    **/
    _removeInputGraphics: function () {
      array.forEach(this.gpInputDetails, lang.hitch(this, function (
        item) {
        this.map.removeLayer(item);
      }));
    },

    /**
    *This function will start the asynchronous call as well as check and create the Parameter for the GP call.
    **/
    _GPExecute: function () {
      var params = {},
        featureset, noFlags;
      if (this.toolbar !== null) {
        this.toolbar.deactivate();
        this.toolbar = null;
      }
      domClass.add(this.btnTrace, "jimu-state-disabled");
      this.btnTrace.disabled = true;
      domClass.add(this.btnFlag, "traceControlDisabledDiv");
      domClass.add(this.btnBarrier, "traceControlDisabledDiv");
      this.btnFlag.disabled = true;
      this.btnBarrier.disabled = true;
      //This will reset the Flag Button
      if (this.flagBtnClicked) {
        this.flagBtnClicked = false;
        domClass.remove(this.btnFlag, "flagButtonselected");
        domClass.add(this.btnFlag, "flagbutton");
      }
      //This will reset the barrier button
      if (this.barrierBtnClicked) {
        this.barrierBtnClicked = false;
        domClass.remove(this.btnBarrier, "barrierButtonselected");
        domClass.add(this.btnBarrier, "barrierButton");
      }
      noFlags = false;
      array.forEach(this.gpInputDetails, function (layer) {
        featureset = new FeatureSet();
        featureset.features = layer.graphics;
        if (layer.type === "Flag") {
          if (layer.graphics === null) {
            noFlags = true;
          }
          if (layer.graphics.length === 0) {
            noFlags = true;
          }
        }
        if (layer.graphics.length > 0) {
          params[layer.paramName] = featureset;
        }
      });
      if (noFlags) {
        return false;
      }
      this.gp.submitJob(params);
    },

    /**
    *This function is a call back handler of GP Service submit job completion and this will initialize the GP get results data process.
    *@param{object} message: This is a object parameter which is coming from GP execution.
    **/
    _onSubmitJobComplete: function (message) {
      this._jobID = message.jobInfo.jobId;
      if (message.jobInfo.jobStatus === "esriJobFailed") {
        this._showLoadingIcon(false);
        this._errorMessage(this.nls.GPExecutionFailed);
        this._clearResults();
        return;
      }
      try {
        this._resetResults();
        this.overExtent = null;
        this.resultsCnt = 0;
        this._inputGeomConvexHull = [];
        this._geoForOnlyBuffer = [];
        this.outputStrings = {};
        if (this.config.overview) {
          if (this.config.overview.fieldMap) {
            array.forEach(this.config.overview.fieldMap, function (
              fieldMap) {
              if (fieldMap.type === "value") {
                if (this._verifyParams(message, fieldMap.paramName)) {
                  this._processGPStringResults(message, fieldMap.paramName);
                }
              }
            }, this);
          }
        }
        array.forEach(this.config.geoprocessing.outputs, function (
          output) {
          if (this._verifyParams(message, output.paramName)) {
            this._processGPResults(message, output.paramName);
          }
        }, this);

      } catch (ex) {
        this._showLoadingIcon(false);
        this._errorMessage(ex.message);
        this._clearResults();
      }
    },

    /**
    *This function will display the result panel with the results. This will execute when get result data is complete from GP.
    *@param{object} message: This is a object which is coming from GP execution.
    **/
    _onGetResultDataComplete: function (result) {
      this._showLoadingIcon(false);
      this._showResultPanel(true, result.paramName, result.value.features
        .length);
      array.forEach(this.config.geoprocessing.outputs, lang.hitch(
        this,
        function (output) {
          if (result.paramName === output.paramName) {
            output.results = result.value;
            this._populateResultsToggle(output);
          }
        }));
      this.btnFlag.disabled = false;
      this.btnBarrier.disabled = false;
      this.btnTrace.disabled = false;
      domClass.remove(this.btnTrace, "jimu-state-disabled");
      domClass.remove(this.btnFlag, "traceControlDisabledDiv");
      domClass.remove(this.btnBarrier, "traceControlDisabledDiv");
      domClass.remove(this.btnExportToLayer, "jimu-state-disabled");
      domClass.remove(this.btnSaveToLayer, "jimu-state-disabled");
    },

    /**
    *This function will verify the output parameter with the GP Results.
    *@param{object} message: object which is coming from the GP submit job.
    *@param{string} paramName: Parameter name from which the parameter should be match.
    *@return{boolean}: true or false.
    **/
    _verifyParams: function (message, paramName) {
      var key;
      if (message && message.jobInfo && message.jobInfo.results) {
        for (key in message.jobInfo.results) {
          if (message.jobInfo.results.hasOwnProperty(key)) {
            if (paramName === key) {
              return true;
            }
          }
        }
      }
      return false;
    },

    /**
    *This function will process the GP Results and set the map extent as per the results and display the layers on the map.
    *@param{object} message: object which is coming from the GP Submit Job.
    *@param{string} paramName: parameter name.
    */
    _processGPResults: function (message, paramName) {
      var i, bufferGeometry, convexHullGeometry,
        bufferGeometryGraphic


      this.gp.getResultData(message.jobInfo.jobId, paramName).then(
        lang.hitch(this, function (result) {
          this._onGetResultDataComplete(result);

          this.resultsCnt++;
          if (result.value.features.length > 0) {

            for (i = 0; i < result.value.features.length; i++) {
              this._geoForOnlyBuffer.push(result.value.features[i].geometry);

              if (result.value.geometryType ===
                "esriGeometryPoint") {
                this._inputGeomConvexHull.push(result.value.features[
                  i].geometry);
              } else if (result.value.geometryType ===
                "esriGeometryPolygon") {
                this._inputGeomConvexHull = this._inputGeomConvexHull
                  .concat(this._getVerticesFromPolygon(result.value
                    .features[i].geometry));
              } else if (result.value.geometryType ===
                "esriGeometryPolyline") {
                this._inputGeomConvexHull = this._inputGeomConvexHull
                  .concat(this._getVerticesFromPolyline(result.value
                    .features[i].geometry));
              }
            }
          }
          if (this.resultsCnt === this.config.geoprocessing.outputs
            .length) {
            try {
              var buffDist;
              if (this.config.overview.BufferType && this.config.overview.BufferType === "Buffer") {

                buffDist = [];
                convexHullGeometry = this._geoForOnlyBuffer;
                array.forEach(convexHullGeometry, function (geo) {
                  buffDist.push(this.config.overview.BufferDistance)
                }, this);
              }

              else {
                convexHullGeometry = geometryEngine.convexHull(this
             ._inputGeomConvexHull, true);
                convexHullGeometry = convexHullGeometry[0];
                buffDist = this.config.overview.BufferDistance;

              }
              if (true) {
                bufferGeometry = geometryEngine.buffer(
                  convexHullGeometry, buffDist,
                  this.config.overview.Unit, true);

                if (bufferGeometry) {
                  if (lang.isArray(bufferGeometry)) {
                    bufferGeometry = bufferGeometry[0];
                  }

                  domClass.remove(this.outageCheckBoxDiv,
                    "esriCTHidden");
                  bufferGeometryGraphic = new Graphic(
                    bufferGeometry, null, {});
                  if (this.config.autoZoomAfterTrace) {
                    this.map.setExtent((bufferGeometry.getExtent())
                      .expand(1.8));
                  }
                  if (this.overviewGraphicsLayer) {
                    this.overviewGraphicsLayer.clear();
                  }
                  bufferGeometryGraphic.attributes = {};
                  if (this.overviewGraphicsLayer) {
                    if (this.overviewGraphicsLayer.objectIdField &&
                      this.overviewGraphicsLayer.objectIdField !==
                      "") {
                      bufferGeometryGraphic.attributes[this.overviewGraphicsLayer
                        .objectIdField] = "1";
                    }
                    this.overviewGraphicsLayer.add(
                      bufferGeometryGraphic);
                  }
                } else {
                  domClass.add(this.outageCheckBoxDiv,
                    "esriCTHidden");
                }
              } else {
                domClass.add(this.outageCheckBoxDiv,
                  "esriCTHidden");
              }
            } catch (ex) {
              domClass.add(this.outageCheckBoxDiv, "esriCTHidden");
            }
            if (this.overviewGraphicsLayer && this.overviewGraphicsLayer
              .graphics.length > 0 && this.config.overview.saveToLayer !==
              "") {
              this.btnSaveToLayer.style.display = "block";
              this.btnSaveToLayer.title = this.nls.saveToLayertoolTip;
            }
            this._showResultPanel(true);
            this._showAllResultLayers();
          }
        }));
    },

    _processGPStringResults: function (message, paramName) {

      this.gp.getResultData(message.jobInfo.jobId, paramName).then(
        lang.hitch(this, function (result) {
          this.outputStrings[paramName] = result.value;
        }));
    },

    _getVerticesFromPolygon: function (inputPolygon) {
      var i, j, outputPolygonVertices = [];
      for (i = 0; i < inputPolygon.rings.length; i++) {
        for (j = 0; j < inputPolygon.rings[i].length; j++) {
          outputPolygonVertices.push(new Point(inputPolygon.rings[i][
            j
          ][0], inputPolygon.rings[i][j][1], inputPolygon.spatialReference));
        }
      }
      return outputPolygonVertices;
    },

    _getVerticesFromPolyline: function (inputPolyline) {
      var i, j, outputPolylineVertices = [];
      for (i = 0; i < inputPolyline.paths.length; i++) {
        for (j = 0; j < inputPolyline.paths[i].length; j++) {
          outputPolylineVertices.push(new Point(inputPolyline.paths[i]
            [j][0], inputPolyline.paths[i][j][1], inputPolyline.spatialReference
          ));
        }
      }
      return outputPolylineVertices;
    },

    /**
    *This function will set the visibility of the result layers.
    **/
    _showAllResultLayers: function () {
      array.forEach(this.resultLayers, function (layer) {
        layer.setVisibility(true);
      });
    },

    /**
    *This is a GP error call back function which will alert the user regarding the error while executing the GP service.
    *@param object err: 'err' contains information regarding the error.
    **/
    _onSubmitJobError: function (err) {
      this._errorMessage(err.error.message);
      if (this._showLoadingIcon) {
        this._showLoadingIcon(false);
      }
      this._clearResults();
    },

    /**
    *This function will add the outage area into the map.
    *@param{object} gpParam: object containing information regarding GP input parameter.
    **/
    _populateOverview: function (gpParam) {
      array.forEach(gpParam.results.features, function (feature) {
        this.overExtent = this.overExtent === null ? feature.geometry
          .getExtent() : this.overExtent.union(feature.geometry.getExtent());
        var selectedGraphic = new Graphic(feature.geometry, null,
          feature.attributes, null);
        if (gpParam.layer !== null) {
          gpParam.layer.add(selectedGraphic);
        }
      }, this);
    },

    /**
    *This function will add the results into the Title Pane with High Light and Skip buttons.
    *@param{object} selectedGPParam: object containing information regarding the output features.
    **/
    _populateResultsToggle: function (selectedGPParam) {
      var skipBtnTitle = "",
        zoomToText = "",
        objectIDValue, bypassBtnClass, objectIDKey, resultCount,
        process, skipedLocation, selectedGraphic, div, btnControlDiv,
        btnBypassDiv, zoomToHyperLink, resultContainerDataDiv,
        layerName, countLabel, outputLayerObj;
      resultCount = {
        "Count": 0,
        "SkipCount": 0
      };
      resultContainerDataDiv = dom.byId(selectedGPParam.paramName +
        "RCD");
      if (this.config && this.config.geoprocessing && this.config.geoprocessing
        .inputs && this.config.geoprocessing.inputs.length > 0) {
        array.forEach(this.config.geoprocessing.inputs, function (
          input) {
          if (input.type === "Skip") {
            if (input.toolTip !== "" || input.toolTip !== null) {
              skipBtnTitle = input.toolTip;
            }
          }
        });
      }
      objectIDKey = selectedGPParam.bypassDetails.IDField || this._getResultItemObjectID(
        selectedGPParam);
      array.forEach(selectedGPParam.results.features, lang.hitch(this,
        function (resultItem) {
          objectIDValue = resultItem.attributes[objectIDKey] ||
            "";
          process = true;
          zoomToText = "";
          skipedLocation = null;
          if (selectedGPParam.bypassDetails.skipable && this.skipLayer !==
            null) {
            if (this.skipLayer.graphics.length > 0) {
              array.forEach(this.skipLayer.graphics, lang.hitch(
                this,
                function (item) {
                  if (item.GPParam === selectedGPParam.paramName) {
                    if (objectIDValue === item.attributes[
                        objectIDKey]) {
                      process = false;
                      skipedLocation = item;
                      skipedLocation.GPParam =
                        selectedGPParam.paramName;
                      return true;
                    }
                  }
                }));
            }
            if (skipedLocation === null) {
              skipedLocation = new Graphic(resultItem.geometry,
                null, resultItem.attributes, null);
              skipedLocation.GPParam = selectedGPParam.paramName;
            }
          }
          this._formatDateAttributes(selectedGPParam, resultItem);
          selectedGraphic = new Graphic(resultItem.geometry, null,
            resultItem.attributes, null);
          selectedGPParam.layer.add(selectedGraphic);
          div = domConstruct.create("div", {
            "id": selectedGPParam.paramName + ":" +
              objectIDValue + "div",
            "class": "resultItem"
          }, resultContainerDataDiv);
          resultItem.controlDetails = {
            "skipGraphic": skipedLocation,
            "bypassDetails": selectedGPParam.bypassDetails,
            "selectionGraphic": selectedGraphic
          };
          btnControlDiv = domConstruct.create("div", {
            "id": selectedGPParam.paramName + ":" +
              objectIDValue + "controls",
            "class": "resultItemSubDiv"
          }, div);
          if (selectedGPParam.bypassDetails.skipable) {
            btnBypassDiv = null;
            bypassBtnClass = selectedGPParam.paramName +
              objectIDValue + "BtnByPass";
            resultItem.controlDetails.bypassBtnClass =
              bypassBtnClass;
            btnBypassDiv = domConstruct.create("div", {
              "class": "resultItemButtonSkipIcon resultItemButton",
              "title": skipBtnTitle
            }, btnControlDiv);
            domClass.add(btnBypassDiv, bypassBtnClass);
            if (process) {
              resultCount.Count = resultCount.Count + 1;
              resultItem.controlDetails.selectionGraphic.bypassed =
                false;
            } else {
              domClass.add(btnBypassDiv,
                "resultItemButtonSkipIconSelected");
              resultCount.SkipCount = resultCount.SkipCount + 1;
              resultItem.controlDetails.selectionGraphic.bypassed =
                true;
            }
            on(btnBypassDiv, "click", lang.hitch(this, this._onSkipedButton(
              resultItem)));
          } else {
            resultItem.controlDetails.selectionGraphic.bypassed =
              false;
            resultCount.Count = resultCount.Count + 1;
          }
          zoomToHyperLink = domConstruct.create("a", {
            "class": "resultItemLabel",
            "innerHTML": lang.replace(selectedGPParam.displayText,
              resultItem.attributes)
          }, btnControlDiv);
          if (this.appConfig.theme.name === "DartTheme") {
            domAttr.set(btnControlDiv, "style",
              "background-color : transparent !important");
          }
          zoomToText = zoomToHyperLink.textContent ||
            zoomToHyperLink.innerText;
          zoomToHyperLink.innerText = zoomToHyperLink.innerHTML =
            zoomToText;
          if (zoomToHyperLink.innerText.trim() === "") {
            zoomToHyperLink.innerText = "null";
          } else {
            zoomToHyperLink.innerText.trim();
          }
          if (zoomToHyperLink.innerHTML.trim() === "") {
            zoomToHyperLink.innerHTML = "null";
          } else {
            zoomToHyperLink.innerHTML.trim();
          }

          if (zoomToHyperLink.textContent) {
            if (zoomToHyperLink.textContent.trim() === "") {
              zoomToHyperLink.textContent = "null";
            } else {
              zoomToHyperLink.textContent.trim();
            }
          }
          zoomToHyperLink.onclick = lang.hitch(this, this._zoomToBtn(
            resultItem));
          resultItem.controlDetails.selectionGraphic.resultItem =
            resultItem;
          this._setResultInfoTemplate(selectedGraphic,
            selectedGPParam, skipBtnTitle, resultItem);
        }));

      if (selectedGPParam.type === "Result") {
        layerName = dom.byId(selectedGPParam.paramName + "_LN");
        domAttr.set(layerName, "innerHTML", selectedGPParam.panelText +
          " (" + (resultCount.Count + resultCount.SkipCount) + ")");
        domAttr.set(layerName, "title", selectedGPParam.panelText +
          " (" + (resultCount.Count + resultCount.SkipCount) + ")");
        countLabel = dom.byId(selectedGPParam.paramName + "_RCL");
        domAttr.set(countLabel, "innerHTML", selectedGPParam.panelText +
          " (" + (resultCount.Count + resultCount.SkipCount) + ")");
      }
      outputLayerObj = {};
      outputLayerObj.outputLayer = selectedGPParam;
      outputLayerObj.outputLayerResultCount = resultCount;
      this._outputResultArr.push(outputLayerObj);
      this._outputResultCount++;
      if (this._outputResultCount === this.config.geoprocessing.outputs
        .length) {
        this._convertSummaryExpressionIntoValue();
      }
    },

    /**
    * This function is used convert expression into value
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _convertSummaryExpressionIntoValue: function () {
      var summaryExpressionValueResultText;
      summaryExpressionValueResultText = null;
      summaryExpressionValueResultText = this.config.summaryExpression
        .summaryExpressionTrimmedValue;
      summaryExpressionValueResultText = this._convertExpressionRelatedToInputParameter(
        summaryExpressionValueResultText);
      summaryExpressionValueResultText = this._convertExpressionRelatedToOutputParameter(
        summaryExpressionValueResultText);
      if (summaryExpressionValueResultText &&
        summaryExpressionValueResultText !== "") {
        this.resultLayersInformationContainer.innerHTML =
          summaryExpressionValueResultText;
        domClass.remove(this.headPaneTitle, "esriCTBorderNone");
      }
    },

    /**
    * This function is used convert expression into value related to input parameter
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _convertExpressionRelatedToInputParameter: function (
      summaryExpressionValueResultText) {
      var i, expressionArr, j, regExp, replaceValue;
      for (i = 0; i < this.config.summaryExpression.summaryExpressionValueArr
        .length; i++) {
        expressionArr = this.config.summaryExpression.summaryExpressionValueArr[
          i].trimmedValue.split(":");
        for (j = 0; j < this.gpInputDetails.length; j++) {
          if (expressionArr[0] === this.gpInputDetails[j].paramName) {
            regExp = new RegExp("{" + this.config.summaryExpression.summaryExpressionValueArr[
              i].trimmedValue + "}", 'g');
            replaceValue = this.gpInputDetails[j].graphics.length;
            summaryExpressionValueResultText =
              summaryExpressionValueResultText.replace(regExp,
                replaceValue);
          }
        }
      }
      return summaryExpressionValueResultText;
    },

    /**
    * This function is used convert expression into value related to output parameter
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _convertExpressionRelatedToOutputParameter: function (
      summaryExpressionValueResultText) {
      var i, expressionArr, j, regExp, replaceValue;
      for (i = 0; i < this.config.summaryExpression.summaryExpressionValueArr
        .length; i++) {
        expressionArr = this.config.summaryExpression.summaryExpressionValueArr[
          i].trimmedValue.split(":");
        if (expressionArr.length === 2) {
          for (j = 0; j < this._outputResultArr.length; j++) {
            if (expressionArr[0] === this._outputResultArr[j].outputLayer
              .paramName) {
              regExp = new RegExp("{" + this.config.summaryExpression
                .summaryExpressionValueArr[i].trimmedValue + "}",
                'g');
              if (expressionArr[1] === this.config.summaryExpression.summaryExpressionNLS
                .outputOperatorCountOption) {
                replaceValue = this._outputResultArr[j].outputLayerResultCount
                  .Count;
              } else if (expressionArr[1] === this.config.summaryExpression
                .summaryExpressionNLS.outputOperatorSkipCountOption) {
                replaceValue = this._outputResultArr[j].outputLayerResultCount
                  .SkipCount;
              }
              summaryExpressionValueResultText =
                summaryExpressionValueResultText.replace(regExp,
                  replaceValue);
            }
          }
        } else if (expressionArr.length === 3) {
          for (j = 0; j < this._outputResultArr.length; j++) {
            if (expressionArr[0] === this._outputResultArr[j].outputLayer
              .paramName) {
              regExp = new RegExp("{" + this.config.summaryExpression
                .summaryExpressionValueArr[i].trimmedValue + "}",
                'g');
              if (expressionArr[2] === this.config.summaryExpression
                .summaryExpressionNLS.fieldOperatorSumOption) {
                replaceValue = this._getSumValueOfField(this._outputResultArr[
                    j].outputLayer.results.features, expressionArr[
                    1], expressionArr[0], this._outputResultArr[j].outputLayer
                  .bypassDetails.IDField);
              }
              if (expressionArr[2] === this.config.summaryExpression
                .summaryExpressionNLS.fieldOperatorMinOption) {
                replaceValue = this._getMinValueOfField(this._outputResultArr[
                    j].outputLayer.results.features, expressionArr[
                    1], expressionArr[0], this._outputResultArr[j].outputLayer
                  .bypassDetails.IDField);
              }
              if (expressionArr[2] === this.config.summaryExpression
                .summaryExpressionNLS.fieldOperatorMaxOption) {
                replaceValue = this._getMaxValueOfField(this._outputResultArr[
                    j].outputLayer.results.features, expressionArr[
                    1], expressionArr[0], this._outputResultArr[j].outputLayer
                  .bypassDetails.IDField);
              }
              if (expressionArr[2] === this.config.summaryExpression
                .summaryExpressionNLS.fieldOperatorMeanOption) {
                replaceValue = this._getMeanValueOfField(this._outputResultArr[
                    j].outputLayer.results.features, expressionArr[
                    1], expressionArr[0], this._outputResultArr[j].outputLayer
                  .bypassDetails.IDField);
              }
              summaryExpressionValueResultText =
                summaryExpressionValueResultText.replace(regExp,
                  replaceValue);
            }
          }
        }
      }
      return summaryExpressionValueResultText;
    },

    /**
    * This function is used to get summation of field values
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _getSumValueOfField: function (features, field, outputLayerName,
      skipField) {
      var sumArr, i, total, isFeatureSkipped, j;
      sumArr = [];
      for (i = 0; i < features.length; i++) {
        if (features[i].attributes[field] !== null && features[i].attributes[
            field] !== "") {
          isFeatureSkipped = false;
          if (this.skipLayer) {
            if (this.skipLayer.graphics) {
              for (j = 0; j < this.skipLayer.graphics.length; j++) {
                if ((outputLayerName === this.skipLayer.graphics[j].GPParam) &&
                  (features[i].attributes[skipField] === this.skipLayer
                    .graphics[
                      j].attributes[skipField])) {
                  isFeatureSkipped = true;
                }
              }
            }
          }
          if (!isFeatureSkipped) {
            sumArr.push(features[i].attributes[field]);
          }
        }
      }
      if (sumArr.length > 0) {
        total = this._getSummationOfArr(sumArr);
        if (this._decimalPlaces(total) > 2) {
          total = total.toFixed(2);
        }
        return total;
      }
      return 0;
    },

    _decimalPlaces: function (num) {
      var match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
      if (!match) {
        return 0;
      }
      // (match[1] ? match[1].length : 0) --> Number of digits right of decimal point.
      // (match[2] ? +match[2] : 0) --> Adjust for scientific notation.
      // To solve JSHint error(Operator - should be on a new line)
      // comments position is changed in above manner
      return Math.max(0, (match[1] ? match[1].length : 0) - (match[2] ?
        +match[2] : 0));
    },

    /**
    * This function is used to get summation of field values
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _getSummationOfArr: function (sumArr) {
      var total = 0;
      for (var i in sumArr) {
        total += sumArr[i];
      }
      return total;
    },

    /**
    * This function is used to get minimum of field values
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _getMinValueOfField: function (features, field, outputLayerName,
      skipField) {
      var minArr, i, isFeatureSkipped, j, minimumValue;
      minArr = [];
      for (i = 0; i < features.length; i++) {
        if (features[i].attributes[field] !== null && features[i].attributes[
            field] !== "") {
          isFeatureSkipped = false;
          if (this.skipLayer) {
            if (this.skipLayer.graphics) {
              for (j = 0; j < this.skipLayer.graphics.length; j++) {
                if ((outputLayerName === this.skipLayer.graphics[j].GPParam) &&
                  (features[i].attributes[skipField] === this.skipLayer
                    .graphics[
                      j].attributes[skipField])) {
                  isFeatureSkipped = true;
                }
              }
            }
          }
          if (!isFeatureSkipped) {
            minArr.push(features[i].attributes[field]);
          }
        }
      }
      if (minArr.length > 0) {
        minimumValue = Math.min.apply(Math, minArr);
        if (this._decimalPlaces(minimumValue) > 2) {
          minimumValue = minimumValue.toFixed(2);
        }
        return minimumValue;
      }
      return 0;
    },

    /**
    * This function is used to get maximum of field values
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _getMaxValueOfField: function (features, field, outputLayerName,
      skipField) {
      var maxArr, i, isFeatureSkipped, j, maximumValue;
      maxArr = [];
      for (i = 0; i < features.length; i++) {
        if (features[i].attributes[field] !== null && features[i].attributes[
            field] !== "") {
          isFeatureSkipped = false;
          if (this.skipLayer) {
            if (this.skipLayer.graphics) {
              for (j = 0; j < this.skipLayer.graphics.length; j++) {
                if ((outputLayerName === this.skipLayer.graphics[j].GPParam) &&
                  (features[i].attributes[skipField] === this.skipLayer
                    .graphics[
                      j].attributes[skipField])) {
                  isFeatureSkipped = true;
                }
              }
            }
          }
          if (!isFeatureSkipped) {
            maxArr.push(features[i].attributes[field]);
          }
        }
      }
      if (maxArr.length > 0) {
        maximumValue = Math.max.apply(Math, maxArr);
        if (this._decimalPlaces(maximumValue) > 2) {
          maximumValue = maximumValue.toFixed(2);
        }
        return maximumValue;
      }
      return 0;
    },

    /**
    * This function is used to get minimum of field values
    * @memberOf widgets/NetworkTrace/widgets
    **/
    _getMeanValueOfField: function (features, field, outputLayerName,
      skipField) {
      var meanArr, i, total, meanValue, isFeatureSkipped, j;
      meanArr = [];
      for (i = 0; i < features.length; i++) {
        if (features[i].attributes[field] !== null && features[i].attributes[
            field] !== "") {
          isFeatureSkipped = false;
          if (this.skipLayer) {
            if (this.skipLayer.graphics) {
              for (j = 0; j < this.skipLayer.graphics.length; j++) {
                if ((outputLayerName === this.skipLayer.graphics[j].GPParam) &&
                  (features[i].attributes[skipField] === this.skipLayer
                    .graphics[
                      j].attributes[skipField])) {
                  isFeatureSkipped = true;
                }
              }
            }
          }
          if (!isFeatureSkipped) {
            meanArr.push(features[i].attributes[field]);
          }
        }
      }
      if (meanArr.length > 0) {
        total = this._getSummationOfArr(meanArr);
        meanValue = total / meanArr.length;
        if (this._decimalPlaces(meanValue) > 2) {
          meanValue = meanValue.toFixed(2);
        }
        return meanValue;
      }
      return 0;
    },

    _formatDateAttributes: function (selectedGPParam, resultItem) {
      var i;
      if (selectedGPParam.results && selectedGPParam.results.fields) {
        for (i = 0; i < selectedGPParam.results.fields.length; i++) {
          if (selectedGPParam.results.fields[i].type ===
            "esriFieldTypeDate") {
            resultItem.attributes[selectedGPParam.results.fields[i]
              .name] = resultItem.attributes[selectedGPParam.results
              .fields[i].name] ? this._formatDate(resultItem.attributes[
              selectedGPParam.results.fields[i].name]) : "";
          }
        }

      }
    },

    /**
    *This function will return the object id key from the param item attributes.
    **/
    _getResultItemObjectID: function (item) {
      var key;
      for (key in item.results.fields) {
        if (item.results.fields.hasOwnProperty(key)) {
          if (item.results.fields[key].type === "esriFieldTypeOID") {
            return item.results.fields[key].name;
          }
        }
      }
    },

    GpServiceoutputParameter: null,

    _getFieldAliasFromGPService: function () {
      var url, GpServiceParameters = [],
        i, gpServiceOutputParameters = [],
        requestArgs;
      url = this.config.geoprocessing.url;
      requestArgs = {
        url: url,
        content: {
          f: "json"
        },
        handleAs: "json",
        callbackParamName: "callback",
        timeout: 20000
      };
      esriRequest(requestArgs).then(lang.hitch(this, function (
        response) {
        GpServiceParameters = response.parameters;
        for (i = 0; i < GpServiceParameters.length; i++) {
          if (GpServiceParameters[i].direction ===
            "esriGPParameterDirectionOutput") {
            gpServiceOutputParameters.push(GpServiceParameters[
              i]);
          }
        }
        this.GpServiceoutputParameter =
          gpServiceOutputParameters;
      }), lang.hitch(this, function (err) {
        this._errorMessage(err);
      }));
    },

    _setResultInfoTemplate: function (item, param, skipBtnTitle,
      resultItem) {
      var infoTemplateObj, headerText, infoContent, tableDiv,
        btnBypassDiv, attrRow, attrKey, attrValue, attrTable,
        attrTableBody, attrNameCol, i, outputParameterFields = [],
        j;
      infoTemplateObj = new InfoTemplate();
      headerText = resultItem.attributes[param.bypassDetails.IDField] ?
        param.panelText + " : " + resultItem.attributes[param.bypassDetails
          .IDField] : param.panelText;
      infoTemplateObj.setTitle("&nbsp;");
      infoContent = domConstruct.create("div", {
        "class": "attrMainSection"
      });
      domConstruct.create("div", {
        "class": "attrHeader",
        "innerHTML": headerText
      }, infoContent);
      domConstruct.create("div", {
        "class": "attrSeparator"
      }, infoContent);
      tableDiv = domConstruct.create("div", null, infoContent);
      //create table: attrTable
      attrTable = domConstruct.create("table", {
        "class": "attrResultInfoTable"
      }, tableDiv);

      for (i = 0; i < this.GpServiceoutputParameter.length; i++) {
        if (this.GpServiceoutputParameter[i].name === param.paramName) {
          outputParameterFields = this.GpServiceoutputParameter[i].defaultValue
            .fields;
        }
      }
      attrTableBody = domConstruct.create("tbody", {}, attrTable);
      for (attrKey in item.attributes) {
        if (item.attributes.hasOwnProperty(attrKey)) {
          attrValue = item.attributes[attrKey];
          //Create attribute info table row
          attrRow = domConstruct.create("tr", {}, attrTableBody);
          if (attrKey === "OID") {
            attrNameCol = domConstruct.create("td", {
              "innerHTML": "OID",
              "class": "attrName"
            }, attrRow);
          }
          for (j = 0; j < outputParameterFields.length; j++) {
            if (attrKey === outputParameterFields[j].name) {
              attrNameCol = domConstruct.create("td", {
                "innerHTML": (outputParameterFields[j].alias &&
                    outputParameterFields[j].alias !== "") ?
                  outputParameterFields[j].alias : outputParameterFields[
                    j].name,
                "class": "attrName"
              }, attrRow);
            }
          }
          domConstruct.create("td", {
            "innerHTML": (attrValue !== undefined && attrValue !==
              null) ? attrValue : "",
            "class": "attrValue"
          }, attrRow);
        }
      }

      if (param.bypassDetails.skipable) {
        attrRow = domConstruct.create("tr", {}, attrTableBody);
        attrNameCol = domConstruct.create("td", {
          "class": "attrName",
          "colSpan": 2
        }, attrRow);
        btnBypassDiv = domConstruct.create("div", {
          "class": "resultItemButtonSkipIcon resultItemButton infoPopupSKipIcon",
          "title": skipBtnTitle
        }, attrNameCol);
        if (resultItem.controlDetails.selectionGraphic.bypassed) {
          domClass.add(btnBypassDiv,
            "resultItemButtonSkipIconSelected");
        }
        domClass.add(btnBypassDiv, resultItem.controlDetails.bypassBtnClass);
        on(btnBypassDiv, "click", lang.hitch(this, this._onSkipedButton(
          resultItem)));
      }
      infoTemplateObj.setContent(infoContent);
      item.setInfoTemplate(infoTemplateObj);
    },

    /**
    *This function will execute when user cliked on skiped button.
    *param{object}resultItem: Object containing information regarding the feature which going to be skipped.
    **/
    _onSkipedButton: function (resultItem) {
      return function () {
        var btnList = query("." + resultItem.controlDetails.bypassBtnClass);
        if (this.skipLayer !== null) {
          array.forEach(btnList, lang.hitch(this, function (btnNode) {
            domClass.toggle(btnNode,
              "resultItemButtonSkipIconSelected");
          }));
          if (resultItem.controlDetails.selectionGraphic.bypassed) {
            this.skipLayer.remove(resultItem.controlDetails.skipGraphic);
            resultItem.controlDetails.selectionGraphic.bypassed =
              false;
          } else {
            this.skipLayer.add(resultItem.controlDetails.skipGraphic);
            resultItem.controlDetails.selectionGraphic.bypassed =
              true;
          }
        }
        this._resetResultInfoTemplate(resultItem);
      };
    },

    _resetResultInfoTemplate: function (resultItem) {
      var nodes, templateContent = resultItem.controlDetails.selectionGraphic
        .infoTemplate.content;
      nodes = query(".infoPopupSKipIcon", templateContent);
      if (nodes.length > 0) {
        if (resultItem.controlDetails.selectionGraphic.bypassed) {
          domClass.add(nodes[0], "resultItemButtonSkipIconSelected");
        } else {
          domClass.remove(nodes[0],
            "resultItemButtonSkipIconSelected");
        }
      }
    },

    /**
    *This function will zoom into the particular feature.
    *@param{object} resultItem:object containing information regarding feature which to be zoom.
    **/
    _zoomToBtn: function (resultItem) {
      return function () {
        var geometry;
        if (resultItem.controlDetails.selectionGraphic.geometry.type ===
          "polyline") {
          geometry = this._getLineCenter(resultItem.controlDetails.selectionGraphic
            .geometry);
        } else if (resultItem.controlDetails.selectionGraphic.geometry
          .type === "polygon") {
          geometry = this._getPolygonCentroid(resultItem.controlDetails
            .selectionGraphic.geometry);
        } else if (resultItem.controlDetails.selectionGraphic.geometry
          .type === "point") {
          geometry = resultItem.controlDetails.selectionGraphic.geometry;
        }
        if (geometry) {
          this.map.centerAt(geometry);
          this._showHighlightedFeature(geometry);
        }
      };
    },

    /**
    * This function will provide the centroid of the polyline.
    * @param{object} polyline: object containing information regarding the polyline geometry.
    **/
    _getLineCenter: function (polyline) {
      var path, pointIndex, startPoint, endPoint;
      path = polyline.paths[Math.round(polyline.paths.length / 2) - 1];
      pointIndex = Math.round((path.length - 1) / 2) - 1;
      startPoint = path[pointIndex];
      endPoint = path[pointIndex + 1];
      return new Point((startPoint[0] + endPoint[0]) / 2.0, (
        startPoint[1] + endPoint[1]) / 2.0, polyline.spatialReference);
    },

    /**
    * This function will provide the centroid of the polygon.
    * @param{object} polygon: object containing information regarding the polygon geometry.
    **/
    _getPolygonCentroid: function (polygon) {
      var ring, centroid, i, point;
      ring = polygon.rings[Math.round(polygon.rings.length / 2) - 1];
      centroid = {
        x: 0,
        y: 0
      }; // Array object
      for (i = 0; i < ring.length; i++) {
        point = ring[i];
        centroid.x += point[0];
        centroid.y += point[1];
      }
      centroid.x /= ring.length;
      centroid.y /= ring.length;
      return new Point(centroid.x, centroid.y, polygon.spatialReference);
    },

    /**
    *This function will add the High Lighted Graphic to the Graphic layer.
    *@param{object} geometery: object containing information regarding the Feature which to be high light.
    **/
    _showHighlightedFeature: function (geometry) {
      this.animatedLayer.clear();
      this.timer.stop();
      var highightGraphic = new Graphic(geometry, null, null, null);
      this.animatedLayer.add(highightGraphic);
      this.timer.start();
    },

    /**
    *This function will create High Lighting Graphic Layer and decide the highlighting time for the Graphic.
    **/
    _createTimer: function () {
      var animatedSymbol, animatedRenderer, jsonObj, baseURL, imgURL;
      this.timer = new Timing.Timer(this.config.highlighterDetails.timeout);
      this.animatedLayer = new GraphicsLayer();
      if (this.config.highlighterDetails.imageData.indexOf("default") >
        -1) {
        imgURL = this.config.highlighterDetails.imageData.slice(this.config
          .highlighterDetails.imageData.indexOf("widgets"));
        imgURL = imgURL.replace(/\/\//g, "/");
      } else {
        imgURL = this.config.highlighterDetails.imageData;
      }
      baseURL = location.href.slice(0, location.href.lastIndexOf('/'));
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
      this.animatedLayer.id = "animatedLayer";
      this.animatedLayer.setRenderer(animatedRenderer);
      this.map.addLayer(this.animatedLayer);
      this.timer.onTick = lang.hitch(this, function () {
        this.timer.stop();
        this.animatedLayer.clear();
      });
    },

    /**
    *This function will clear the result layers.
    **/
    _resetResults: function () {
      this.map.graphics.clear();
      //Looping through the output layers and then clearing the layer.
      array.forEach(this.config.geoprocessing.outputs, function (
        output) {
        //checking whether layer is null or not.
        if (output.layer) {
          output.layer.clear();
        }
      }, this);
    },

    /**
    *This function will clear the input layers.
    **/
    _resetInputs: function () {
      //Looping through the Input layers and then clearing the layer.
      array.forEach(this.gpInputDetails, function (input) {
        input.clear();
      }, this);
    },

    /**
    *This function will assign the color to the trace buttons
    *param{string} color
    *param{domNode}DOM Node
    **/
    _changeDomNodeColor: function (color, domNode) {
      style.set(domNode, "backgroundColor", color);
    },

    /**
    *This function will popup jimu popup with error message
    *param {string}err: string containing error message
    **/
    _errorMessage: function (err) {
      var errorMessage = new JimuMessage({
        message: err
      });
      errorMessage.message = err;
    },

    /**
    * This function will show and hide Input Locations List
    */
    _onInputLocTabClick: function () {
      style.set(this.inputLocDiv, "display", "block");
      this._tabContainer.controlNode.style.display = "none";
      style.set(this.tracePanel, "display", "none");
      style.set(this.InputBarrierTabContent, "display", "none");
      on(this.inputBackClick, "click", lang.hitch(this, function () {
        style.set(this.inputLocDiv, "display", "none");
        this._tabContainer.controlNode.style.display = "block";
        style.set(this.tracePanel, "display", "block");
        style.set(this.InputBarrierTabContent, "display",
          "block");
      }));
    },

    /**
    * This function will show and hide barrier locations List
    */
    _onBarrierLocTabClick: function () {
      style.set(this.barrierLocDiv, "display", "block");
      this._tabContainer.controlNode.style.display = "none";
      style.set(this.tracePanel, "display", "none");
      style.set(this.InputBarrierTabContent, "display", "none");
      on(this.barrierBackClick, "click", lang.hitch(this, function () {
        style.set(this.barrierLocDiv, "display", "none");
        this._tabContainer.controlNode.style.display = "block";
        style.set(this.tracePanel, "display", "block");
        style.set(this.InputBarrierTabContent, "display",
          "block");
      }));
    },

    /**
    * This function will add feature to input location list
    * param{object} feature that will be added in input location list
    * param{string} information of layer type
    */
    _addInputLocation: function (graphic, type) {
      var inputFlagDiv, inputFlagAnchor, inputFlagCloseDiv;
      this._flagCount++;
      this._inputFlag++;
      style.set(this.InputBarrierTabContent, "display", "block");
      style.set(this.inputLocTab, "display", "block");
      domAttr.set(this.lblInputLoc, "innerHTML", this.nls.lblInputLocTab +
        " (" + this._flagCount + ")");
      domAttr.set(this.flagCountLabel, "innerHTML", this.nls.lblInputLocTab +
        " (" + this._flagCount + ")");

      inputFlagDiv = domConstruct.create("div", {
        "class": "esriCTInputFlagDiv"
      });
      domAttr.set(inputFlagDiv, "Graphic", JSON.stringify(graphic));
      domAttr.set(inputFlagDiv, "LayerType", type);
      inputFlagAnchor = domConstruct.create("a", {
        "class": "esriCTInputLocAnchor",
        "innerHTML": this.nls.lblInputLocation + this._inputFlag
      }, inputFlagDiv);
      if (this.appConfig.theme.name === "DartTheme") {
        domAttr.set(inputFlagDiv, "style",
          "background-color : transparent !important");
      }
      inputFlagCloseDiv = domConstruct.create("div", {
        "class": "esriCTInputFlagCloseDiv"
      }, inputFlagDiv);
      domConstruct.place(inputFlagDiv, this.flagLocContent);
      // delete input location tabs on click of close icon
      this.own(on(inputFlagCloseDiv, "click", lang.hitch(this,
        function (evt) {
          this._onClickCloseRemoveGraphics(evt);
          this._flagCount--;
          domAttr.set(this.lblInputLoc, "innerHTML", this.nls
            .lblInputLocTab + " (" + this._flagCount + ")");
          domAttr.set(this.flagCountLabel, "innerHTML", this.nls
            .lblInputLocTab + " (" + this._flagCount + ")");
          // if flagLocContent children is 0 then go to input tab
          if (this.flagLocContent.children.length === 0) {
            domClass.add(this.btnTrace, "jimu-state-disabled");
            this.btnTrace.disabled = true;
            style.set(this.inputLocTab, "display", "none");
            style.set(this.inputLocDiv, "display", "none");
            this._tabContainer.controlNode.style.display =
              "block";
            style.set(this.InputBarrierTabContent, "display",
              "block");
            style.set(this.tracePanel, "display", "block");
            if (this.barrierLocContent.children.length === 0) {
              style.set(this.InputBarrierTabContent, "display",
                "none");
            }
          }
        })));

      this.own(on(inputFlagAnchor, "click", lang.hitch(this, function (
        evt) {
        this._onClickHighlightLocations(evt);
      })));
    },

    /**
    * This function will add feature in barrier list
    * param{object} feature that will be added in barrier list
    * param{string} information of layer type
    */
    _addBarrierLocation: function (graphic, type) {
      var blockDiv, blockAnchor, blockCloseDiv;
      this._barrierCount++;
      this._inputBlock++;
      style.set(this.InputBarrierTabContent, "display", "block");
      style.set(this.barrierLocTab, "display", "block");
      domAttr.set(this.lblBlockLoc, "innerHTML", this.nls.lblBlockLocTab +
        " (" + this._barrierCount + ")");
      domAttr.set(this.barrierCountLabel, "innerHTML", this.nls.lblBlockLocTab +
        " (" + this._barrierCount + ")");
      blockDiv = domConstruct.create("div", {
        "class": "esriCTInputFlagDiv"
      });
      domAttr.set(blockDiv, "Graphic", JSON.stringify(graphic));
      domAttr.set(blockDiv, "LayerType", type);
      blockAnchor = domConstruct.create("a", {
        "class": "esriCTInputLocAnchor",
        "innerHTML": this.nls.lblBlockLocation + this._inputBlock
      }, blockDiv);
      if (this.appConfig.theme.name === "DartTheme") {
        domAttr.set(blockDiv, "style",
          "background-color : transparent !important");
      }
      blockCloseDiv = domConstruct.create("div", {
        "class": "esriCTInputFlagCloseDiv"
      }, blockDiv);
      domConstruct.place(blockDiv, this.barrierLocContent);

      this.own(on(blockCloseDiv, "click", lang.hitch(this, function (
        evt) {
        this._onClickCloseRemoveGraphics(evt);
        this._barrierCount--;
        domAttr.set(this.lblBlockLoc, "innerHTML", this.nls.lblBlockLocTab +
          " (" + this._barrierCount + ")");
        domAttr.set(this.barrierCountLabel, "innerHTML", this
          .nls.lblBlockLocTab + " (" + this._barrierCount +
          ")");
        if (this.barrierLocContent.children.length === 0) {
          style.set(this.barrierLocTab, "display", "none");
          style.set(this.barrierLocDiv, "display", "none");
          style.set(this.InputBarrierTabContent, "display",
            "block");
          this._tabContainer.controlNode.style.display =
            "block";
          style.set(this.tracePanel, "display", "block");
          if (this.flagLocContent.children.length === 0) {
            style.set(this.InputBarrierTabContent, "display",
              "none");
          }
        }
      })));

      this.own(on(blockAnchor, "click", lang.hitch(this, function (evt) {
        this._onClickHighlightLocations(evt);
      })));
    },

    /**
    * This function will remove selected feature from map
    * param{object} feature that needs to be removed
    */
    _onClickCloseRemoveGraphics: function (evt) {
      var graphic, layerType;
      graphic = JSON.parse(domAttr.get(evt.currentTarget.parentNode,
        "Graphic"));
      layerType = domAttr.get(evt.currentTarget.parentNode,
        "LayerType");
      array.some(this.gpInputDetails, function (layer) {
        if (layer.type === layerType) {
          array.some(layer.graphics, function (graphics) {
            if (graphics.attributes.ObjID === graphic.attributes
              .ObjID) {
              layer.remove(graphics);
              return true;
            }
          });
        }
      });
      domConstruct.destroy(evt.currentTarget.parentNode);
    },

    /**
    * This function will highlight selected feature on map
    * param{object} feature on map which needs to be highlighted
    */
    _onClickHighlightLocations: function (evt) {
      var graphic, locGeometry, layerType;
      graphic = JSON.parse(domAttr.get(evt.currentTarget.parentNode,
        "Graphic"));
      layerType = domAttr.get(evt.currentTarget.parentNode,
        "LayerType");
      if (graphic) {
        array.some(this.gpInputDetails, lang.hitch(this, function (
          layer) {
          if (layer.type === layerType) {
            array.some(layer.graphics, lang.hitch(this,
              function (graphics) {
                if (graphics.attributes.ObjID === graphic.attributes
                  .ObjID) {
                  locGeometry = graphics.geometry;
                  this.map.centerAt(locGeometry);
                  this._showHighlightedFeature(locGeometry);
                  return true;
                }
              }));
          }
        }));
      }
    },

    /**
    * This function will handle the styling of tab theme's trace panel div for mobile view
    * @memberOf widgets/NetworkTrace/Widget
    */
    _enhanceTabThemeStyle: function () {
      var tracePanelDiv;
      tracePanelDiv = query(".jimu-widget-NetworkTrace .tracePanel")[
        0];
      if (tracePanelDiv) {
        if (this.appConfig.theme.name === "TabTheme") {
          domClass.add(tracePanelDiv, "esriCTTabThemePaddding");
        } else {
          domClass.remove(tracePanelDiv, "esriCTTabThemePaddding");
        }
      }
    },

    /**
    * This function will handle the styling of Dart theme on IE9
    * @memberOf widgets/NetworkTrace/Widget
    */
    _enhanceDartThemeStyle: function () {
      var mainDivContainer;
      if (this.appConfig.theme.name === "DartTheme") {
        this._setDartInlineStyle();
        domAttr.set(this.resultPanel, "style",
          "padding : 0px !important");
        style.set(this.InputBarrierTabContent, "display", "none");
        if (has("ie") === 9) {
          mainDivContainer = query(
            ".jimu-widget-frame.jimu-container")[
            0];
          domClass.add(mainDivContainer, "esriCTDartBackgroudColor");
        }
      }
    },

    /**
    * This function will fetch and process classes whose Background color to be override
    * @memberOf widgets/NetworkTrace/Widget
    */
    _setDartInlineStyle: function () {
      var i, classContainerObject = [];
      classContainerObject.push(query(
        ".esriCTInputBarrierTabContainer"));
      classContainerObject.push(query(".esriCTInputBarrierLoc"));
      classContainerObject.push(query(".tracePanel"));
      classContainerObject.push(query(".resultsHeadText"));
      classContainerObject.push(query(
        ".esriCTResultsLayerNamesContainer"));
      classContainerObject.push(query(".esriCTResultContainer"));
      classContainerObject.push(query(
        ".esriCTLayerInformationContainer"));
      // looping for setting grey Background color for dart theme
      for (i = 0; i < classContainerObject.length; i++) {
        this._setInlineStyle(classContainerObject[i]);
      }
    },

    /**
    * This function setting inline styling of Dart theme Background color
    * @memberOf widgets/NetworkTrace/Widget
    */
    _setInlineStyle: function (classNode) {
      var i;
      // setting inline font color styling for every node contains the specific class
      for (i = 0; i < classNode.length; i++) {
        domAttr.set(classNode[i], "style",
          "background-color: transparent !important; padding-right: 0px; padding-left: 0px;"
        );
      }
    },

    /**
    * This function override styling of Launchpad theme
    * @memberOf widgets/NetworkTrace/Widget
    */
    _enhanceLaunchpadThemeStyle: function () {
      var i, comboBoxButtonNodeArrowButton;
      if (this.appConfig.theme.name === "LaunchpadTheme") {
        // quering combobox button node
        comboBoxButtonNodeArrowButton = query(
          ".claro .dijitComboBox>div.dijitArrowButton.dijitDownArrowButton");
        for (i = 0; i < comboBoxButtonNodeArrowButton.length; i++) {
          domAttr.set(comboBoxButtonNodeArrowButton[i], "style",
            "height: 30px !important");
        }
      }
    },

    /**
    * This function is used to add focus class on text box click for IE9
    * @param{object} Element node to which class needs to be added
    * @memberOf widgets/NetworkTrace/Widget
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
    * @memberOf widgets/NetworkTrace/Widget
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
    * @memberOf widgets/NetworkTrace/Widget
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
    * This function is used to modify content value of date picker button node in dart theme
    * @memberOf widgets/NetworkTrace/Widget
    */
    _modifyDatePickerButtonNodeContent: function () {
      var dijitArrowButtondiv, i;
      dijitArrowButtondiv = query(".dijitArrowButton");
      if (dijitArrowButtondiv) {
        for (i = 0; i < dijitArrowButtondiv.length; i++) {
          domClass.add(dijitArrowButtondiv[i],
            "dijitArrowButtonBlankContent");
        }
      }
    },

    /**
    * Function for setting dart theme background color on IE 9
    * @memberOf widgets/NetworkTrace/Widget
    */
    _setDartBackgroudColorForIE9: function () {
      var dijitTextBoxdiv, dijitButtonNodediv, i, dijitInputInnerdiv,
        dijitArrowButtondiv;
      dijitTextBoxdiv = query(".dijitTextBox");
      dijitButtonNodediv = query(".dijitButtonNode");
      dijitInputInnerdiv = query(".dijitInputInner");
      dijitArrowButtondiv = query(".dijitArrowButton");

      if (dijitArrowButtondiv) {
        for (i = 0; i < dijitArrowButtondiv.length; i++) {
          domClass.add(dijitArrowButtondiv[i], "dijitArrowButtonIE9");
        }
      }

      // loop for adding class for applying CSS on input field of div text box div
      // in dart theme in case of  IE9
      if (dijitTextBoxdiv) {
        for (i = 0; i < dijitTextBoxdiv.length; i++) {
          this._addFocusClassOnTextBoxClick(dijitTextBoxdiv[i]);
        }
      }
      // loop for adding class for applying CSS on input field of div text box div
      // in dart theme in case of  IE9
      if (dijitInputInnerdiv) {
        for (i = 0; i < dijitInputInnerdiv.length; i++) {
          this._addFocusClassOnDateChange(dijitInputInnerdiv[i]);
          this._addClassOnFocus(dijitInputInnerdiv[i]);
        }
      }
      // loop for adding class for applying CSS on button div of select div
      //in dart theme in case of  IE9
      if (dijitButtonNodediv) {
        for (i = 0; i < dijitButtonNodediv.length; i++) {
          domClass.add(dijitButtonNodediv[i], "dijitButtonNodeIE9");
        }
      }
    }
  });
});