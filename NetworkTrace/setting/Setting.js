/*global define,dijit */
/** @license
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
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  'dijit/_WidgetsInTemplateMixin',
  'jimu/BaseWidgetSetting',
  'dojox/validate/regexp',
  "esri/request",
  "dojo/_base/lang",
  "dijit/TitlePane",
  "dojo/dom-construct",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/query",
  "dojo/on",
  "dojo/dom-attr",
  "jimu/dijit/GpSource",
  "jimu/dijit/Popup",
  "dojo/_base/array",
  "jimu/dijit/Message",
  "jimu/dijit/LoadingIndicator",
  "dijit/registry",
  "./inputSetting",
  "./outputSetting",
  "./othersSetting",
  "./outageSetting",
  "./summarySetting"
], function (
  declare,
  _WidgetBase,
  _TemplatedMixin,
  _WidgetsInTemplateMixin,
  BaseWidgetSetting,
  regexp,
  esriRequest,
  lang,
  TitlePane,
  domConstruct,
  dom,
  domClass,
  query,
  on,
  domAttr,
  GpSource,
  Popup,
  array,
  Message,
  LoadingIndicator,
  registry,
  InputSetting,
  OutputSetting,
  OthersSetting,
  OutageSetting,
  SummarySetting
) {
  return declare([BaseWidgetSetting, _WidgetBase, _TemplatedMixin,
    _WidgetsInTemplateMixin
  ], {
    baseClass: 'jimu-widget-NetworkTrace-setting',
    url: null,
    config: {},
    gpServiceTasks: null,
    inputParametersArray: [],
    outputParametersArray: [],
    validConfig: false,

    startup: function () {
      this.inherited(arguments);
    },

    postCreate: function () {
      // validating the fetching the request data
      setTimeout(lang.hitch(this, function () {
        if (this.config && this.config.geoprocessing && this.config
          .geoprocessing.url) {
          this.txtURL.set('value', this.config.geoprocessing.url);
          this._resetConfigParams();
          this._validateGPServiceURL();
        }
      }), 200);
      this._initLoading();
    },

    /**
    * function  enables or disables set button on textbox input.
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _resetConfigParams: function () {
      var gpURL = this.txtURL.get('value');

      // if input value is null or empty then disable all the config options.
      if (gpURL === null || gpURL === "") {
        domConstruct.empty(this.taskData);
        this._destroyWidget(this.inputProperty);
        this._destroyWidget(this.outputAdditionalProperty);
        domConstruct.empty(this.othersData);
        domClass.add(this.taskDataContainer, "esriCTHidden");
      }
    },

    /**
    * Set task URL button click handler.
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _onChooseTaskClicked: function () {
      var args = {
        portalUrl: this.appConfig.portalUrl
      },
        gpSource = new GpSource(args),
        popup = new Popup({
          titleLabel: "Set Task",
          width: 830,
          height: 560,
          content: gpSource
        });

      this.own(on(gpSource, 'ok', lang.hitch(this, function (tasks) {
        if (tasks.length === 0) {
          popup.close();
          return;
        }
        this.config = {};
        this.txtURL.set('value', tasks[0].url);
        this._resetConfigParams();
        this._validateGPServiceURL();
        popup.close();
      })));
      this.own(on(gpSource, 'cancel', lang.hitch(this, function () {
        popup.close();
      })));
    },

    /**
    * This function will execute when user clicked on the "Set Task."
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _validateGPServiceURL: function () {
      this.gpServiceTasks = [];
      var requestArgs, gpTaskParameters = [];
      this.loading.show();
      this._destroyWidget(this.inputProperty);
      this._destroyWidget(this.outputAdditionalProperty);

      if (this.map && this.map.itemInfo && this.map.itemInfo.itemData &&
        this.map.itemInfo.itemData.operationalLayers && (this.map.itemInfo
          .itemData.operationalLayers.length > 0)) {
        // if the task URL is valid
        this.url = this.txtURL.value;
        requestArgs = {
          url: this.url,
          content: {
            f: "json"
          },
          handleAs: "json",
          callbackParamName: "callback",
          timeout: 20000
        };
        esriRequest(requestArgs).then(lang.hitch(this, function (
          response) {
          // if response returned from the queried request
          if (response.hasOwnProperty("name")) {
            // if name value exist in response object
            if (response.name !== null) {
              gpTaskParameters = response.parameters;
              // if gpTaskParameters array is not null
              if (gpTaskParameters) {
                this._validateGpTaskResponseParameters(
                  gpTaskParameters);
              }
            }
          } else {
            this._refreshConfigContainer();
            this.loading.hide();
          }
        }), lang.hitch(this, function () {
          this._errorMessage(this.nls.validationErrorMessage.UnableToLoadGeoprocessError);
          this._refreshConfigContainer();
          this.loading.hide();
        }));
      } else {
        this.loading.hide();
        this._errorMessage(this.nls.validationErrorMessage.webMapError);
      }
    },

    /**
    * This function Validates the gp task response parameters
    * @param{object} gpTaskParameters gp service response object
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _validateGpTaskResponseParameters: function (gpTaskParameters) {
      var i, recordSetValCheckFlag = true,
        inputParametersArr = [],
        inputGPParamFlag = true,
        errMsg;
      // loop for checking gptask type is GPFeatureRecordSetLayer or not
      for (i = 0; i < gpTaskParameters.length; i++) {
        // if gp task is not GPFeatureRecordSetLayer then flag to false
        //if (gpTaskParameters[i].dataType !==
        //  "GPFeatureRecordSetLayer") {
        //  recordSetValCheckFlag = false;
        //}
        // if gp task parameter type is of input type
        if (gpTaskParameters[i].direction ===
          "esriGPParameterDirectionInput" &&
          gpTaskParameters[i].dataType ===
            "GPFeatureRecordSetLayer") {
          inputParametersArr.push(gpTaskParameters[i]);
        }
      }
      // if number of input parameters is less than 1 or greater than 3 then set flag to false
      if (inputParametersArr.length < 1 || inputParametersArr.length >
        3) {
        inputGPParamFlag = false;
      }
      // if all the gp task is having type "GPFeatureRecordSetLayer"
      if (recordSetValCheckFlag && inputGPParamFlag) {
        this.validConfig = true;
        this._showTaskDetails(gpTaskParameters);
        this.loading.hide();
      } else {
        this._refreshConfigContainer();
        this.loading.hide();
        // if the gp task does not having type "GPFeatureRecordSetLayer"
        if (!recordSetValCheckFlag) {
          errMsg = this.nls.GPFeatureRecordSetLayerERR;
        } else if (!inputGPParamFlag) {
          // if number of input parameters is less than 1 or greater than 3 then show error message
          errMsg = this.nls.invalidInputParameters;
        } else if (!recordSetValCheckFlag && !inputGPParamFlag) {
          // if the gp task does not having type "GPFeatureRecordSetLayer" neither input parameters is less than 0 and greater than 3 then
          errMsg = this.nls.inValidGPService;
        }
        this.txtURL.set('value', "");
        this.url = "";
        this._errorMessage(errMsg);
      }
    },

    /**
    * This function used for refresh the task container every time new request executed
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _refreshConfigContainer: function () {
      domConstruct.empty(this.taskData);
      domConstruct.empty(this.inputProperty);
      domConstruct.empty(this.outputAdditionalProperty);
      domConstruct.empty(this.othersData);
      domClass.add(this.taskDataContainer, "esriCTHidden");
    },

    /**
    * This function used for loading indicator
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _initLoading: function () {
      this.loading = new LoadingIndicator({
        hidden: true
      });
      this.loading.placeAt(this.domNode);
      this.loading.startup();
    },

    /**
    * This function brings focus of tab content on top
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _focusTop: function () {
      var node = dom.byId('taskDataContainerId');
      node.scrollTop = 0;
    },

    /**
    * This function destroy widget if created
    * @param{object} div
    * @memberOf widgets/isolation-trace/settings/settings.js
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
    * This function is called to show task details.
    * @param{array} gpTaskParameters
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _showTaskDetails: function (gpTaskParameters) {
      var i;
      domConstruct.empty(this.taskData);
      domClass.remove(this.taskDataContainer, "esriCTHidden");
      // if geo-processing input/output parameters exist
      if (gpTaskParameters) {
        this.inputParametersArray = [];
        this.outputParametersArray = [];
        this.outputStrings = [];
        // loop for creating input and output parameters array
        for (i = 0; i < gpTaskParameters.length; i++) {
          if (gpTaskParameters[i].direction ===
            "esriGPParameterDirectionInput" &&
            gpTaskParameters[i].dataType ===
              "GPFeatureRecordSetLayer") {
            this.inputParametersArray.push(gpTaskParameters[i]);
          } else if (gpTaskParameters[i].direction ===
            "esriGPParameterDirectionOutput" &&
            gpTaskParameters[i].dataType ===
              "GPFeatureRecordSetLayer") {
            this.outputParametersArray.push(gpTaskParameters[i]);
          } else if (gpTaskParameters[i].direction ===
            "esriGPParameterDirectionOutput" &&
            gpTaskParameters[i].dataType ===
              "GPString") {
            this.outputStrings.push(gpTaskParameters[i]);
          }
        }
      }

      // if output parameter array is not null
      if (this.outputParametersArray && this.outputParametersArray.length >
        0) {
        this._sortOutputParam();
      }

      // output parameters array is greater than zero
      if (this.inputParametersArray && this.inputParametersArray.length >
        0) {
        // creates the input task parameters panel
        this._createInputTaskParameters();
      }
      // output parameters array is greater than zero
      if (this.outputParametersArray && this.outputParametersArray.length >
        0) {
        // creates the output task parameters panel
        this._createOutputTaskParameters();
        // creates summary tab
        this._createSummaryTextSetting();
        //Outage task.
        //this._createOutageTaskParameters();
        this._createOutageTaskParameter();
      }
      // creates the Others task parameters panel
      this._createOthersTaskParameters();
    },

    /**
    * This function is used to create summary expression UI
    * @memberOf widgets/NetworkTrace/settings/settings
    **/
    _createSummaryTextSetting: function () {
      var summaryHolderDiv = this._createSummaryTab();
      this._onClickSelectSummarySettingTab(summaryHolderDiv);
      this._displaySummaryExpressionBuilder();
      this._getInputPanelData();
    },

    /**
    * This function is used to create summary tab
    * @memberOf widgets/NetworkTrace/settings/settings
    **/
    _createSummaryTab: function () {
      var summaryHolderDiv;
      summaryHolderDiv = domConstruct.create("div", {
        "class": "esriCTSummaryHolder",
        "innerHTML": this.nls.summaryTab.summaryTabText
      }, this.taskData);
      return summaryHolderDiv;
    },

    /**
    * This function is used to highlight summary tab
    * @memberOf widgets/NetworkTrace/settings/settings
    **/
    _onClickSelectSummarySettingTab: function (summaryHolderDiv) {
      on(summaryHolderDiv, "click", lang.hitch(this, function (evt) {
        var m, selectedItems;
        selectedItems = query(".esriCTSelected", this.taskData);
        // loop for selecting the clicked others and deselecting rest of the all
        for (m = 0; m < selectedItems.length; m++) {
          domClass.remove(selectedItems[m], 'esriCTSelected');
        }
        domClass.add(evt.currentTarget, "esriCTSelected");
        domClass.add(this.esriCTInputOutputParameters,
          "esriCTHidden");
        domClass.remove(this.taskDataContainer, "esriCTHidden");
        domClass.add(this.outageData, "esriCTHidden");
        domClass.add(this.othersData, "esriCTHidden");
        domClass.remove(this.summaryTextData, "esriCTHidden");
        if (this._summarySettingObjArr) {
          array.forEach(this._summarySettingObjArr, lang.hitch(
            this,
            function (widgetNode) {
              if (widgetNode) {
                widgetNode.refreshOperator();
              }
            }));
        }
      }));
    },

    /**
    * This function is used to display summary expression page
    * @memberOf widgets/NetworkTrace/settings/settings
    **/
    _displaySummaryExpressionBuilder: function () {
      var summarySettingInstance, param;
      domConstruct.empty(this.summaryTextData);
      param = {
        "nls": this.nls,
        "config": this.config,
        "inputParametersArray": this.inputParametersArray,
        "outputParametersArray": this.outputParametersArray,
        "outputSettingArray": this.outputSettingArray
      };
      this._summarySettingObjArr = [];
      summarySettingInstance = new SummarySetting(param, domConstruct
        .create("div", {}, this.summaryTextData));
      this._summarySettingObjArr.push(summarySettingInstance);
    },

    /**
    * This function is used to fetch data for input panel
    * @memberOf widgets/NetworkTrace/settings/settings
    **/
    _getInputPanelData: function () {
      if (this._summarySettingObjArr) {
        array.forEach(this._summarySettingObjArr, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              widgetNode.displayInputOutputParameters();
            }
          }));
      }
    },

    /**
    * This function is called Sort the output parameters in polygon, polyline and point type sequence respectively
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _sortOutputParam: function () {
      var i, j;
      this.tempOutputParameters = [];
      if (this.config && this.config.geoprocessing && this.config.geoprocessing
        .outputs && this.config.geoprocessing.outputs.length > 0) {
        for (i = 0; i < this.outputParametersArray.length; i++) {
          for (j = 0; j < this.config.geoprocessing.outputs.length; j++) {
            if (this.outputParametersArray[i].name === this.config.geoprocessing
              .outputs[j].paramName) {
              this.tempOutputParameters.push(this.config.geoprocessing
                .outputs[j]);
            }
          }
        }
        this.config.geoprocessing.outputs = [];
        this.config.geoprocessing.outputs = this.tempOutputParameters;
      }
    },

    /**
    * This function is called set the outage by pass variable which comes from output task.
    * @memberOf widgets/isolation-trace/settings/settings.js
    */
    _setOutageByPass: function () {
      var outputParam;
      // loop for outage setting bypass value from output parameters
      array.forEach(this.outputSettingArray, lang.hitch(this,
        function (widgetNode) {
          if (widgetNode) {
            outputParam = widgetNode.getOutputForm();
            // if save to layer is not null
            if (outputParam.saveToLayer !== "") {
              this.outageSettingObj.outageLayerName = outputParam
                .saveToLayer;
            }
          }
        }));
    },

    /**
    * This function creates input task parameters panel and data container
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _createInputTaskParameters: function () {
      var inputTP, inputTitlepaneDiv, j, inputContainer, param,
        inputSettingInstance, inputConfig;
      inputTitlepaneDiv = domConstruct.create("div", {
        "id": "esriCTInputHolder",
        "class": "esriCTInputTitlepaneHolder"
      }, this.taskData);
      inputContainer = domConstruct.create("div", {
        "class": "inputContainer"
      });
      // if input parameters array length is greater than zero
      if (this.inputParametersArray.length >= 0) {
        inputTP = new TitlePane({
          title: this.nls.inputPanel.inputTask,
          open: true,
          content: inputContainer
        });
        this.inputSettingArray = [];
        // loop for populating input data in input fields and also creating additional input fields dynamically
        for (j = 0; j < this.inputParametersArray.length; j++) {
          // if input parameterType is required field then reflect Required as a true otherwise false
          if (this.inputParametersArray[j].parameterType ===
            "esriGPParameterTypeRequired") {
            this.inputParametersArray[j].isInputRequired = "True";
          } else {
            this.inputParametersArray[j].isInputRequired = "False";
          }

          inputConfig = null;
          // if config object is not null
          if (this.config && this.config.geoprocessing && this.config
            .geoprocessing.inputs[j]) {
            inputConfig = this.config.geoprocessing.inputs[j];
          }
          param = {
            "nls": this.nls,
            "data": this.inputParametersArray[j],
            "ObjId": "selectInput_" + j,
            "inputConfig": inputConfig,
            "parentContainer": inputContainer,
            "folderUrl": this.folderUrl,
            "id": "ParameterDiv_" + j + "_" + this.inputParametersArray[
              j].displayName
          };
          // selectInput id already wxist then destroy it
          if (dijit.byId("selectInput_" + j)) {
            dijit.byId("selectInput_" + j).destroy();
          }
          inputSettingInstance = new InputSetting(param, domConstruct
            .create("div", {}, this.inputProperty));
          this.inputSettingArray.push(inputSettingInstance);
          // if counter is at one for displaying first value selected by default
          if (j === 0) {
            domClass.add(inputSettingInstance.inputDataNode,
              "esriCTSelected");
            domClass.remove(inputSettingInstance.domNode,
              "esriCTHidden");
            domClass.remove(this.inputProperty, "esriCTHidden");
            domClass.remove(this.esriCTInputOutputParameters,
              "esriCTHidden");
            domClass.add(this.othersData, "esriCTHidden");
            domClass.add(this.outageData, "esriCTHidden");
            domClass.add(this.outputAdditionalProperty,
              "esriCTHidden");
            domClass.add(this.summaryTextData, "esriCTHidden");
          }
          this._inputTaskClicked(inputSettingInstance);
          this._onInputTypeChange(inputSettingInstance);

        }
        // if title pane is created then append complete dom HTML
        if (inputTP) {
          inputTitlepaneDiv.appendChild(inputTP.domNode);
        }
      }
    },

    _inputTaskClicked: function (inputSettingInstance) {
      var selectedItems, m;
      inputSettingInstance.inputFieldClicked = lang.hitch(this,
        function (widgetNode) {
          selectedItems = query(".esriCTSelected", this.taskData);
          // if selectedItems node is not null
          if (selectedItems) {
            // loop for deselecting the all the left menu panel
            for (m = 0; m < selectedItems.length; m++) {
              domClass.remove(selectedItems[m], 'esriCTSelected');
            }
          }
          // loop for selecting the clicked left menu and deselecting rest of the all
          array.forEach(this.inputSettingArray, function (node) {
            domClass.add(node.domNode, "esriCTHidden");
            domClass.remove(node.inputDataNode,
              "esriCTSelected");
          });
          domClass.remove(widgetNode.domNode, "esriCTHidden");
          domClass.add(widgetNode.inputDataNode, "esriCTSelected");
          domClass.remove(this.esriCTInputOutputParameters,
            "esriCTHidden");
          domClass.add(this.othersData, "esriCTHidden");
          domClass.add(this.outageData, "esriCTHidden");
          domClass.add(this.outputAdditionalProperty,
            "esriCTHidden");
          domClass.add(this.summaryTextData, "esriCTHidden");
          domClass.remove(this.inputProperty, "esriCTHidden");
          this._focusTop();
        });
    },

    _onInputTypeChange: function (inputSettingInstance) {
      inputSettingInstance.inputTypeChange = lang.hitch(this,
        function () {
          var k, key, skipFlag = false;
          // loop of all the input array, which checks if input type of parameter containing Skip or not
          for (k in this.inputSettingArray) {
            if (this.inputSettingArray.hasOwnProperty(k)) {
              // if input type is "Skip" then only
              if (this.inputSettingArray[k].inputTypeData && this.inputSettingArray[
                  k].inputTypeData.value === "Skip") {
                skipFlag = true;
                break;
              }
            }
          }
          // loop to show and hide skippable checkbox for all output parameters except outage type
          for (key in this.outputSettingArray) {
            if (this.outputSettingArray.hasOwnProperty(key)) {
              if (this.outputSettingArray[key]) {
                // if the output parameters type is esriGeometryPoint then only
                if (this.outputSettingArray[key].data && this.outputSettingArray[
                    key].data.defaultValue && this.outputSettingArray[
                    key].data.defaultValue.geometryType ===
                  "esriGeometryPoint" && skipFlag) {
                  domClass.remove(this.outputSettingArray[key].skippableCheckboxBlock,
                    "esriCTHidden");
                } else {
                  //domClass.remove(this.outputSettingArray[key].skippable.checkNode, "checked");
                  this.outputSettingArray[key].skippable.setValue(false);
                  this.outputSettingArray[key].inputTypeData.set(
                    "value", this.outputSettingArray[key].inputTypeData
                    .options[0].value);
                  domClass.add(this.outputSettingArray[key].skippableCheckboxBlock,
                    "esriCTHidden");
                  domClass.add(this.outputSettingArray[key].skippableDropdownDiv,
                    "esriCTHidden");
                }
              }
            }
          }

        });
    },

    /**
    * This function creates output task panel and data container
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _createOutputTaskParameters: function () {
      var outputTitlepaneDiv, outputContainer, outputTP, param,
        outputConfig, selectedItems, m;
      outputTitlepaneDiv = domConstruct.create("div", {
        "id": "esriCTOutputHolder",
        "class": "esriCTOutputTitlepaneHolder"
      }, this.taskData);
      outputContainer = domConstruct.create("div", {
        "class": "outputContainer"
      });
      // if output parameters array length is greater than zero
      if (this.outputParametersArray.length >= 0) {
        outputTP = new TitlePane({
          title: this.nls.outputPanel.outputTask,
          open: false,
          content: outputContainer
        });
        this.outputSettingArray = [];
        // loop for populating output data in output fields and also creating additional output fields dynamically
        array.forEach(this.outputParametersArray, lang.hitch(this,
          function (outputParameters, k) {
            // if input parameterType is required field then reflect Required as a true otherwise false
            if (outputParameters.parameterType ===
              "esriGPParameterTypeRequired") {
              outputParameters.isOutputRequired = "True";
            } else {
              outputParameters.isOutputRequired = "False";
            }

            outputConfig = null;
            // if config object is not null
            if (this.config && this.config.geoprocessing && this.config
              .geoprocessing.outputs[k]) {
              outputConfig = this.config.geoprocessing.outputs[k];
            }
            param = {
              "nls": this.nls,
              "data": outputParameters,
              "ObjId": "selectOutput_" + k,
              "map": this.map,
              "outputConfig": outputConfig,
              "parentContainer": outputContainer,
              "folderUrl": this.folderUrl,
              "id": "ParameterDiv_" + k + "_" +
                outputParameters.name
            };
            if (dijit.byId("selectOutput_" + k)) {
              dijit.byId("selectOutput_" + k).destroy();
            }
            this.outputSettingInstance = new OutputSetting(param,
              domConstruct.create("div", {}, this.outputAdditionalProperty)
            );
            domAttr.set(this.outputSettingInstance.domNode,
              "displayName", outputParameters.name);
            this.outputSettingArray.push(this.outputSettingInstance);

            this.outputSettingInstance.outputFieldClicked = lang.hitch(
              this,
              function (widgetNode) {
                selectedItems = query(".esriCTSelected", this.taskData);
                // loop for selecting the clicked outage and deselecting rest of the all
                for (m = 0; m < selectedItems.length; m++) {
                  domClass.remove(selectedItems[m],
                    'esriCTSelected');
                }
                array.forEach(this.outputSettingArray, function (
                  node) {
                  domClass.add(node.domNode, "esriCTHidden");
                  domClass.remove(node.outputDataNode,
                    "esriCTSelected");
                });

                domClass.remove(widgetNode.domNode,
                  "esriCTHidden");
                domClass.add(widgetNode.outputDataNode,
                  "esriCTSelected");
                domClass.remove(this.esriCTInputOutputParameters,
                  "esriCTHidden");
                domClass.add(this.othersData, "esriCTHidden");
                domClass.add(this.outageData, "esriCTHidden");
                domClass.add(this.inputProperty, "esriCTHidden");
                domClass.add(this.summaryTextData,
                  "esriCTHidden");
                domClass.remove(this.outputAdditionalProperty,
                  "esriCTHidden");
                this._focusTop();
              });
            // for handling the check and uncheck event of save to layer checkbox
            this.outputSettingInstance.layerChangeHandler = lang.hitch(
              this,
              function () {
                this._setOutageByPass();
              });
            // for handling the target layer name from dropdown on change event of save to layer
            this.outputSettingInstance.layerChangeHandler = lang.hitch(
              this,
              function () {
                this._setOutageByPass();
              });
            // if title pane is created then append complete Dom HTML
            if (outputTP) {
              outputTitlepaneDiv.appendChild(outputTP.domNode);
            }
          }));
      }
    },

    _disableOutageOutputPanel: function () {
      var hideOutputDiv, i;
      // if outage panel created
      if (this.outageSettingObj) {
        // loop for  traversing all the output container and searches for outage area
        array.forEach(this.outputSettingArray, lang.hitch(this,
          function (widgetNode) {
            // if dom node found
            if (widgetNode && widgetNode.domNode) {
              var displayName = domAttr.get(widgetNode.domNode,
                "displayName");
              // if outage area drop down is not null and the this particular container belongs to the outage area
              if (displayName && this.outageSettingObj.outageAreaDropDown &&
                this.outageSettingObj.outageAreaDropDown.value ===
                displayName) {
                hideOutputDiv = query(".esriCTOutputOutageField",
                  widgetNode.domNode);
                if (hideOutputDiv && hideOutputDiv.length > 0) {
                  // loop for traversing all the div block with class name esriCTOutputOutageField
                  for (i = 0; i < hideOutputDiv.length; i++) {
                    domClass.add(hideOutputDiv[i], 'esriCTHidden');
                  }
                }
              } else {
                if (widgetNode.domNode) {
                  hideOutputDiv = query(
                    ".esriCTOutputOutageField", widgetNode.domNode
                  );
                  if (hideOutputDiv && hideOutputDiv.length > 0) {
                    // loop for traversing all the div block with class name esriCTOutputOutageField
                    for (i = 0; i < hideOutputDiv.length; i++) {
                      domClass.remove(hideOutputDiv[i],
                        'esriCTHidden');
                    }
                  }
                }
              }
            }
          }));
      }
    },

    _createOutageTaskParameter: function () {
      var OutageHolderDiv, selectedItems, m, overviewConfig, param,
        outageSettingInstance;
      OutageHolderDiv = domConstruct.create("div", {
        "id": "esriCTOutageHolder",
        "class": "esriCTSelectedOutageHolder",
        "innerHTML": this.nls.outagePanel.outage
      }, this.taskData);
      on(OutageHolderDiv, "click", lang.hitch(this, function (evt) {
        selectedItems = query(".esriCTSelected", this.taskData);
        // loop for selecting the clicked others and deselecting rest of the all
        for (m = 0; m < selectedItems.length; m++) {
          domClass.remove(selectedItems[m], 'esriCTSelected');
        }
        domClass.add(evt.target.id, "esriCTSelected");
        domClass.add(this.esriCTInputOutputParameters,
          "esriCTHidden");
        domClass.remove(this.taskDataContainer, "esriCTHidden");
        domClass.add(this.othersData, "esriCTHidden");
        domClass.add(this.summaryTextData, "esriCTHidden");
        domClass.remove(this.outageData, "esriCTHidden");
        this._focusTop();
      }));
      this.outageSettingObj = [];
      domConstruct.empty(this.outageData);
      overviewConfig = null;
      // if config object is not null
      if (this.config && this.config.overview) {
        overviewConfig = this.config.overview;
      }

      param = {
        "nls": this.nls,
        "data": this.outputParametersArray,
        "outputStrings": this.outputStrings,
        "folderUrl": this.folderUrl,
        "map": this.map,
        "overviewConfig": overviewConfig
      };
      outageSettingInstance = new OutageSetting(param, domConstruct.create(
        "div", {}, this.outageData));
      this.outageSettingObj.push(outageSettingInstance);
    },
    /**
    * This function creates output task parameters panel and data container
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _createOthersTaskParameters: function () {
      var m, othersConfig, othersSettingInstance, OthersHolderDiv,
        selectedItems, param, displayTextForRunButton,
        autoZoomAfterTraceCheckedState;
      OthersHolderDiv = domConstruct.create("div", {
        "id": "esriCTOtherHolder",
        "class": "esriCTOtherHolder",
        "innerHTML": this.nls.OthersHighlighter.others
      }, this.taskData);
      on(OthersHolderDiv, "click", lang.hitch(this, function (evt) {
        selectedItems = query(".esriCTSelected", this.taskData);
        // loop for selecting the clicked others and deselecting rest of the all
        for (m = 0; m < selectedItems.length; m++) {
          domClass.remove(selectedItems[m], 'esriCTSelected');
        }
        domClass.add(evt.target.id, "esriCTSelected");
        domClass.add(this.esriCTInputOutputParameters,
          "esriCTHidden");
        domClass.remove(this.taskDataContainer, "esriCTHidden");
        domClass.add(this.outageData, "esriCTHidden");
        domClass.add(this.summaryTextData, "esriCTHidden");
        domClass.remove(this.othersData, "esriCTHidden");
      }));
      this.othersSettingObj = [];
      domConstruct.empty(this.othersData);
      othersConfig = null;
      displayTextForRunButton = null;
      if (this.config && this.config.highlighterDetails) {
        othersConfig = this.config.highlighterDetails;
      }
      if (this.config && this.config.displayTextForRunButton) {
        displayTextForRunButton = this.config.displayTextForRunButton;
      }
      autoZoomAfterTraceCheckedState = false;
      if (this.config && this.config.autoZoomAfterTrace) {
        autoZoomAfterTraceCheckedState = this.config.autoZoomAfterTrace;
      }
      param = {
        "nls": this.nls,
        "folderUrl": this.folderUrl,
        "othersConfig": othersConfig,
        "displayTextForRunButton": displayTextForRunButton,
        "autoZoomAfterTraceCheckedState": autoZoomAfterTraceCheckedState
      };
      othersSettingInstance = new OthersSetting(param, domConstruct.create(
        "div", {}, this.othersData));
      this.othersSettingObj.push(othersSettingInstance);
    },

    /**
    * This function creates skippables fields
    * @return {object} returns the url validator object
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _urlValidator: function (value) {
      var strReg, regexValue, regexValueForTest, regexValueForService,
        finalValue;
      // Checking for regex expression for url validation
      strReg = '^' + regexp.url({
        allowNamed: true,
        allLocal: false
      });
      // Checking for regex value
      regexValue = new RegExp(strReg, 'g');
      regexValueForTest = regexValue.test(value);
      regexValueForService = /\/rest\/services/gi;
      finalValue = regexValueForService.test(value);
      return regexValueForTest && finalValue;
    },

    /**
    * This function creates the Input Parameters in config
    * @return {object} returns the config ouject
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _getInputConfigParameters: function () {
      var inputParam = {};
      this.config.geoprocessing.inputs = [];
      this.config.geoprocessing.inputs.length = 0;
      // if input param object created
      if (this.inputSettingArray) {
        array.forEach(this.inputSettingArray, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              inputParam = widgetNode.getInputForm();
              this.config.geoprocessing.inputs.push(inputParam);
            }
          }));
      }
    },

    /**
    * This function creates the overview Parameters in config
    * @return {object} returns the config Outage
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _getOverviewConfigParameters: function () {
      var overviewParam, cloneOverviewParamArray = "";
      // if input param object created
      if (this.outageSettingObj) {
        array.forEach(this.outageSettingObj, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              overviewParam = widgetNode.getOverviewForm();
              cloneOverviewParamArray = lang.clone(overviewParam);
              this.config.overview = cloneOverviewParamArray;
            }
          }));
      }
    },

    _getSummaryExpressionConfigParameters: function () {
      if (this._summarySettingObjArr) {
        array.forEach(this._summarySettingObjArr, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              this.config.summaryExpression = widgetNode.getSummaryExpressionConfigData();
            }
          }));
      }
    },

    /**
    * This function creates the output Parameters in config file
    * return {object} returns the config object
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _getOutputConfigParameters: function () {
      var outputParam = {},
        i, j, k, l;
      this.polygonOutputParameters = [];
      this.polylineOutputParameters = [];
      this.pointOutputParameters = [];
      if (this.config && this.config.geoprocessing && this.config.geoprocessing
        .outputs) {
        this.config.geoprocessing.outputs = [];

        // if input param object created
        if (this.outputSettingArray) {
          array.forEach(this.outputSettingArray, lang.hitch(this,
            function (widgetNode) {
              if (widgetNode) {
                outputParam = widgetNode.getOutputForm();
                // Pushing value in geoprocessing output parameter
                this.config.geoprocessing.outputs.push(
                  outputParam);
              }
            }));
        }
        // if config object is not null and output parameter length is greater than zero
        if (this.config && this.config.geoprocessing && this.config.geoprocessing
          .outputs && this.config.geoprocessing.outputs.length > 0) {
          // loop for traverse output array and pushing all the output object in three different array's by there geometry
          for (i = 0; i < this.config.geoprocessing.outputs.length; i++) {
            // the output array parameter same as config output parameter
            if (this.outputParametersArray[i].parameter === this.config
              .geoprocessing.outputs[i].param) {
              // if the output type is esriGeometryPolygon or esriGeometryPolyline or esriGeometryPoint
              if (this.outputParametersArray[i].defaultValue.geometryType ===
                "esriGeometryPolygon") {
                this.polygonOutputParameters.push(this.config.geoprocessing
                  .outputs[i]);
              } else if (this.outputParametersArray[i].defaultValue.geometryType ===
                "esriGeometryPolyline") {
                this.polylineOutputParameters.push(this.config.geoprocessing
                  .outputs[i]);
              } else if (this.outputParametersArray[i].defaultValue.geometryType ===
                "esriGeometryPoint") {
                this.pointOutputParameters.push(this.config.geoprocessing
                  .outputs[i]);
              }
            }
          }

          this.config.geoprocessing.outputs = [];
          this.tempPolygonOutputParameters = [];
          // if polygon type parameter array is not null
          if (this.polygonOutputParameters && this.polygonOutputParameters
            .length > 0) {

            for (j = 0; j < this.polygonOutputParameters.length; j++) {
              this.config.geoprocessing.outputs.push(this.polygonOutputParameters[
                j]);
            }
          }
          // if polyline type parameter array is not null
          if (this.polylineOutputParameters && this.polylineOutputParameters
            .length > 0) {
            for (k = 0; k < this.polylineOutputParameters.length; k++) {
              this.config.geoprocessing.outputs.push(this.polylineOutputParameters[
                k]);
            }
          }
          // if point type parameter array is not null
          if (this.pointOutputParameters && this.pointOutputParameters
            .length > 0) {
            for (l = 0; l < this.pointOutputParameters.length; l++) {
              this.config.geoprocessing.outputs.push(this.pointOutputParameters[
                l]);
            }
          }
        }
      }
    },

    /**
    * This function creates the other  parameters in config file
    * @return {object} returns highlighter details object
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _getOtherConfigParameters: function () {
      var othersParam;
      // if Others setting Obj is created
      if (this.othersSettingObj) {
        array.forEach(this.othersSettingObj, lang.hitch(this,
          function (widgetNode) {
            //if widget obj found for Others config details for highlighter image
            if (widgetNode) {
              othersParam = widgetNode.getOthersForm();
              this.config.displayTextForRunButton = othersParam.displayTextForRunButton;
              //delete othersParam.displayTextforRunButton;
              this.config.highlighterDetails = othersParam.highlighterDetails;
              this.config.autoZoomAfterTrace = othersParam.autoZoomAfterTrace;
            }
          }));
      }
    },

    /**
    * This function gets and create config data in config file.
    * @return {object} Object of config
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    getConfig: function () {
      var highlighterDetails = {},
        inputArray = [],
        outputArray = [],
        geoprocessingObject = {},
        validateInputTask = false,
        validateOutputTask = false,
        validateOutageTask = false,
        validateOthersTask = false,
        validateSaveToLayer = false,
        validateSummaryExpression = false;
      // Setting object for highlighted details
      highlighterDetails = {
        "imageData": "",
        "height": "",
        "width": "",
        "timeout": ""
      };
      // Setting geoprocessing object
      geoprocessingObject = {
        "url": "",
        "inputs": inputArray,
        "outputs": outputArray
      };
      // if the requested gp task is valid then only
      if (this.validConfig) {
        // Setting config object
        validateInputTask = this._validateInputTaskParameters();
        validateOutputTask = this._validateOutputTaskParameters();
        validateSummaryExpression = this._validateSummaryExpressionParameter();
        validateOutageTask = this._validateOutageTaskParameters();
        validateOthersTask = this._validateOthersTaskParameters();
        validateSaveToLayer = this._validateSaveToLayerParameters();
        // validating the configuration inputs
        if (!this.url || this.url === "") {
          this._errorMessage(this.nls.inValidGPService);
        } else if (validateInputTask.returnFlag) {
          this._errorMessage(validateInputTask.returnErr);
          validateInputTask = false;
        } else if (validateOutputTask.returnFlag) {
          this._errorMessage(validateOutputTask.returnErr);
          validateInputTask = false;
        } else if (validateSummaryExpression.returnFlag) {
          this._errorMessage(validateSummaryExpression.returnErr);
          validateInputTask = false;
        } else if (validateOutageTask.returnFlag) {
          this._errorMessage(validateOutageTask.returnErr);
          validateInputTask = false;
        } else if (validateOthersTask.returnFlag) {
          this._errorMessage(validateOthersTask.returnErr);
          validateInputTask = false;
        } else if (validateSaveToLayer.returnFlag) {
          this._errorMessage(validateSaveToLayer.returnErr);
          validateInputTask = false;
        }
        if (validateInputTask) {
          // Setting config object
          this.config = {
            "highlighterDetails": highlighterDetails,
            "geoprocessing": geoprocessingObject
          };
          // setting url in config object
          this.config.geoprocessing.url = this.url;
          // Get config for input parameters
          this._getInputConfigParameters();
          // Get config for Output parameters
          this._getOutputConfigParameters();
          // Get config for others parameter
          this._getOtherConfigParameters();
          // Get config for overview parameter
          this._getOverviewConfigParameters();
          // Get config for summary expression builder
          this._getSummaryExpressionConfigParameters();
        } else {
          return false;
        }
      } else {
        this._errorMessage(this.nls.inValidGPService);
        return false;
      }
      return this.config;
    },

    /**
    * This function will validate 'Save To Layer' target layer.
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateSaveToLayerParameters: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      },
        saveToLayerCount = [],
        l, m, uniqueSaveToLayerCount = [],
        tempFlag = true,
        key, tempValue;
      //Pushing those output parameter in which Save to layer is checked.
      if (this.outputSettingArray) {
        // Loop through the output setting array to get elements
        for (key in this.outputSettingArray) {
          // Checking if array has property
          if (this.outputSettingArray.hasOwnProperty(key)) {
            // Checking if output setting array is checked
            if (this.outputSettingArray[key].outputLayer && this.outputSettingArray[
                key].outputLayer.getValue()) {
              // Pushing the save to layer value in an array
              saveToLayerCount.push(this.outputSettingArray[key].outputLayerType
                .value);
            }
          }
        }
      }
      // Checking if the overview div is available
      if (this.outageSettingObj) {
        // Looping to overview div
        for (l = 0; l < this.outageSettingObj.length; l++) {
          // Checking for the save to layer checkbox is checked
          if (this.outageSettingObj[l].outputLayer && this.outageSettingObj[
              l].outputLayer.getValue()) {
            saveToLayerCount.push(this.outageSettingObj[l].outputLayerType
              .value);
          }
        }
      }
      // Looping to save to layer value for validation
      for (m = 0; m < saveToLayerCount.length; m++) {
        // If any of the save to layer drop down value is empty then show error message
        if (saveToLayerCount[m] === "") {
          returnObj.returnErr = this.nls.validationErrorMessage.saveToLayerTargetLayers;
          returnObj.returnFlag = true;
          return returnObj;
        }
      }

      //Checking whether array has duplicate values or not.
      tempFlag = saveToLayerCount.slice(0).every(function (item, index, // jshint ignore:line
        array) {
        if (uniqueSaveToLayerCount.indexOf(item) > -1) {
          array.length = 0;
          tempValue = false;
        } else {
          uniqueSaveToLayerCount.push(item);
          tempValue = true;
        }
        return tempValue;
      });
      if (!tempFlag) {
        returnObj.returnErr = this.nls.validationErrorMessage.saveToLayerTargetLayers;
        returnObj.returnFlag = true;
      }
      return returnObj;
    },

    _validateSummaryExpressionParameter: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      };
      if (this._summarySettingObjArr) {
        array.forEach(this._summarySettingObjArr, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              returnObj = widgetNode.validateExpressionOnOkClick();
            }
          }));
      }
      return returnObj;
    },

    /**
    * This function validates the Other parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateOthersTaskParameters: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      },
        othersParam, imageDataOBJ;
      // if Others setting Obj is created
      if (this.othersSettingObj) {
        array.forEach(this.othersSettingObj, lang.hitch(this,
          function (otherData) {
            //if widget obj found for Others config details for highlighter image
            if (otherData) {
              othersParam = otherData.getOthersForm();
              imageDataOBJ = otherData.imageDataObj;
              //otherData.imageChooser.imageData;
              if (othersParam && othersParam.highlighterDetails &&
                othersParam.displayTextForRunButton !== null &&
                imageDataOBJ) {
                if (imageDataOBJ === "" || imageDataOBJ === null) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .otherHighlighterImage;
                  returnObj.returnFlag = true;
                }
                if (othersParam.displayTextForRunButton === "" ||
                  othersParam.displayTextForRunButton === null ||
                  othersParam.displayTextForRunButton.trim() ===
                  "") {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .displayTextForButtonError;
                  returnObj.returnFlag = true;
                }

                if (othersParam.highlighterDetails.height === "" ||
                  parseInt(othersParam.highlighterDetails.height,
                    10) < 0 || isNaN(parseInt(othersParam.highlighterDetails
                    .height, 10))) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .otherHighlighterImageHeight;
                  returnObj.returnFlag = true;
                }

                if (othersParam.highlighterDetails.width === "" ||
                  parseInt(othersParam.highlighterDetails.width,
                    10) < 0 || isNaN(parseInt(othersParam.highlighterDetails
                    .width, 10))) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .otherHighlighterImageWidth;
                  returnObj.returnFlag = true;
                }

                if (othersParam.highlighterDetails.timeout === "" ||
                  parseInt(othersParam.highlighterDetails.timeout,
                    10) < 0 || isNaN(parseInt(othersParam.highlighterDetails
                    .timeout, 10))) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .otherHighlighterImageTimeout;
                  returnObj.returnFlag = true;
                }

              }
            }
          }));
      }
      return returnObj;
    },

    /**
    * This function validates the input parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateInputTaskParameters: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      },
        flagVal = 0,
        inputTypeData, barrierVal = 0,
        skipVal = 0;
      // if input parameters is created in Dom
      if (this.inputSettingArray) {
        flagVal = 0;
        barrierVal = 0;
        skipVal = 0;
        // loop for parsing all the input parameters for valid set of data
        array.forEach(this.inputSettingArray, lang.hitch(this,
          function (widgetNode) {
            // if widgetNode found
            if (widgetNode && widgetNode.inputTypeData) {
              inputTypeData = widgetNode.inputTypeData.value;
              // if input type is flag then count the number of flag type input
              if (inputTypeData === "Flag") {
                flagVal++;
              } else if (inputTypeData === "Barrier") {
                // if input type is flag then count the number of Barrier type input
                barrierVal++;
              } else if (inputTypeData === "Skip") {
                // if input type is flag then count the number of Skip type input
                skipVal++;
              }
            }
          }));

      }
      // if flag type input is greater than 1 and less than 1
      if (flagVal > 1) {
        returnObj.returnErr = this.nls.validationErrorMessage.inputTypeFlagGreaterThanError;
        returnObj.returnFlag = true;
      } else if (flagVal < 1) {
        returnObj.returnErr = this.nls.validationErrorMessage.inputTypeFlagLessThanError;
        returnObj.returnFlag = true;
      } else if (barrierVal > 1) {
        // if barrier type input is greater than 1
        returnObj.returnErr = this.nls.validationErrorMessage.inputTypeBarrierErr;
        returnObj.returnFlag = true;
      } else if (skipVal > 1) {
        // if skip type input is greater than 1
        returnObj.returnErr = this.nls.validationErrorMessage.inputTypeSkipErr;
        returnObj.returnFlag = true;
      }
      return returnObj;
    },

    /**
    * This function validates the output parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateOutputTaskParameters: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      },
        key, validSummary = false,
        validDisplayTextArr, displayTextVal, validDisplay;
      // if output parameters is created in Dom
      if (this.outputSettingArray) {
        // loop for parsing all the output parameters for valid set of data
        for (key in this.outputSettingArray) {

          if (this.outputSettingArray.hasOwnProperty(key)) {
            validDisplayTextArr = [];
            // if outage area drop down is not null and the this particular container belongs to the outage area
            if (this.outputSettingArray[key].outputLabelData && this.outputSettingArray[
                key].outputMinScaleData &&
              this.outputSettingArray[key].outputMaxScaleData) {
              if ((this.outputSettingArray[key].outputLabelData.value ===
                  "" || this.outputSettingArray[key].outputLabelData.value ===
                  null) ||
                (this.outputSettingArray[key].outputDisplayText.value ===
                  "" || this.outputSettingArray[key].outputDisplayText
                  .value === null) ||
                (this.outputSettingArray[key].outputMinScaleData.value ===
                  "" || this.outputSettingArray[key].outputMinScaleData
                  .value === null ||
                  isNaN(parseInt(this.outputSettingArray[key].outputMinScaleData
                    .value, 10)) || (parseInt(this.outputSettingArray[
                    key].outputMinScaleData.value, 10) < 0)) || (this
                  .outputSettingArray[key].outputMaxScaleData.value ===
                  "" ||
                  this.outputSettingArray[key].outputMaxScaleData.value ===
                  null || isNaN(parseInt(this.outputSettingArray[key]
                    .outputMaxScaleData.value, 10)) || (parseInt(this
                    .outputSettingArray[key].outputMaxScaleData.value,
                    10) < 0))) {
                // label value is null
                if ((this.outputSettingArray[key]) && (this.outputSettingArray[
                    key].outputLabelData) && (this.outputSettingArray[
                    key].outputLabelData.value === "" || this.outputSettingArray[
                    key].outputLabelData.value === null)) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputLabelDataErr + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = true;
                } else if ((this.outputSettingArray[key]) && (this.outputSettingArray[
                    key].outputDisplayText) && (this.outputSettingArray[
                    key].outputDisplayText.value === "" || this.outputSettingArray[
                    key].outputDisplayText.value === null)) {
                  // if Display text value is null
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputDisplayDataErr + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = true;
                } else if ((this.outputSettingArray[key]) && (this.outputSettingArray[
                    key].outputMinScaleData) && (this.outputSettingArray[
                    key].outputMinScaleData.value === "" || this.outputSettingArray[
                    key].outputMinScaleData.value === null || isNaN(
                    parseInt(this.outputSettingArray[key].outputMinScaleData
                      .value, 10)) || parseInt(this.outputSettingArray[
                    key].outputMinScaleData.value, 10) < 0)) {
                  // if min scale is value is null or not an number
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputMinScaleDataErr + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = true;
                } else if ((this.outputSettingArray[key]) && (this.outputSettingArray[
                    key].outputMaxScaleData) && (this.outputSettingArray[
                    key].outputMaxScaleData.value === "" || this.outputSettingArray[
                    key].outputMaxScaleData.value === null || isNaN(
                    parseInt(this.outputSettingArray[key].outputMaxScaleData
                      .value, 10)) || parseInt(this.outputSettingArray[
                    key].outputMaxScaleData.value, 10) < 0)) {
                  // if max scale is value is null or not an number
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputMaxScaleDataErr + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = true;
                }

              } else {
                // if the display text value is not null and not and outage area type output
                if (!validSummary && (this.outputSettingArray[key].outputDisplayText) &&
                  this.outputSettingArray[key].outputDisplayText.value !==
                  "") {
                  // if valid set of display text is not null
                  if (this.outputSettingArray[key] && this.outputSettingArray[
                      key].helpTextDataArray && this.outputSettingArray[
                      key].helpTextDataArray.length > 0) {
                    validDisplayTextArr = this.outputSettingArray[key]
                      .helpTextDataArray;
                    displayTextVal = this.outputSettingArray[key].outputDisplayText
                      .value;
                    validDisplay = this._validateDisplayText(
                      displayTextVal, validDisplayTextArr);
                  }
                }
                // if the summary text format is not valid
                if (validSummary) {
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputSummaryDataText + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = validSummary;
                } else if (validDisplay) {
                  // if the display text format is not valid
                  returnObj.returnErr = this.nls.validationErrorMessage
                    .outputDisplayDataText + " in " + this.outputSettingArray[
                      key].data.displayName;
                  returnObj.returnFlag = validDisplay;
                }
              }
            } else {
              returnObj.returnErr = "";
              returnObj.returnFlag = true;
            }
            if (returnObj.returnFlag) {
              break;
            }
          }
        }
      }
      return returnObj;
    },

    /**
    * This function validates the Summary text of output parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateSummaryText: function (summaryTextVal, skippableChecked) {
      var summaryString, i, j, summaryArray = [],
        validArray = [],
        validFlag = false,
        firstPlace, secondPlace, countString, skipCountString;
      countString = "Count";
      skipCountString = "SkipCount";
      summaryTextVal = summaryTextVal.trim();
      firstPlace = summaryTextVal.indexOf("{");
      secondPlace = summaryTextVal.indexOf("}");
      // summary text found with the braces
      if (firstPlace !== -1 && secondPlace !== -1) {
        summaryString = summaryTextVal.split("{");
      } else {
        summaryString = summaryTextVal;
      }
      // if spited array is not null
      if (summaryString && summaryString.length > 0) {
        // loop for spliting the array by "}" string
        for (i = 0; i < summaryString.length; i++) {
          // if value in array is not null
          if (summaryString[i] !== "" && (summaryString[i].indexOf(
              "}") !== -1)) {
            summaryArray[i] = summaryString[i].split("}");
            validArray.push(summaryArray[i][0].toUpperCase());
          }
        }
        // loop for traversing array and checking if summary text contains count and skip count string in defined manner
        for (j = 0; j < validArray.length; j++) {
          if (skippableChecked) {
            // if array index having  "Count" or "SkipCount" string
            if ((validArray[j] === countString.toUpperCase() ||
                validArray[j] === skipCountString.toUpperCase())) {
              //if () {
              validFlag = false;
            } else {
              validFlag = true;
              break;
            }
          } else {
            // if array index having  "Count" string
            if (validArray[j] === countString.toUpperCase()) {
              validFlag = false;
            } else {
              validFlag = true;
              break;
            }
          }
        }
      } else {
        validFlag = true;
      }
      return validFlag;
    },

    /**
    * This function validates the Display text of output parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateDisplayText: function (displayTextVal, validDisplayTextArr) {
      var displayString, i, j, k, validArray = [],
        validFlag = false,
        firstPlace, secondPlace, displayArray = [],
        tempValidDisplayTextArr;
      displayTextVal = displayTextVal.trim();
      firstPlace = displayTextVal.indexOf("{");
      secondPlace = displayTextVal.indexOf("}");
      // display text found with the braces
      if (firstPlace !== -1 && secondPlace !== -1) {
        displayString = displayTextVal.split("{");
      } else {
        displayString = displayTextVal;
      }
      // if spited array is not null
      if (displayString && displayString.length > 0) {
        // loop for spliting the array by "}" string
        for (i = 0; i < displayString.length; i++) {
          // if value in array is not null
          if (displayString[i] !== "" && (displayString[i].indexOf(
              "}") !== -1)) {
            displayArray[i] = displayString[i].split("}");
            validArray.push(displayArray[i][0].toUpperCase());
          }
        }
        tempValidDisplayTextArr = [];
        // loop for traversing array and changing all elements in array to uppercase
        for (k = 0; k < validDisplayTextArr.length; k++) {
          tempValidDisplayTextArr[k] = validDisplayTextArr[k].toUpperCase();
        }
        validFlag = false;
        // loop for traversing array and checking if display text contains valid data or not
        for (j = 0; j < validArray.length; j++) {
          // if array index having valid string
          if (tempValidDisplayTextArr.indexOf(validArray[j]) === -1) {
            validFlag = true;
            break;
          }
        }
      } else {
        validFlag = true;
      }
      return validFlag;
    },

    /**
    * This function validates the Overview parameters
    * @param {return} flag value for validation
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _validateOutageTaskParameters: function () {
      var returnObj = {
        returnErr: "",
        returnFlag: false
      },
        i, overviewParam, fieldNameArr = [],
        paramNameArr = [];
      // if outage type parameters is created in the config outage object
      if (this.outageSettingObj) {
        array.forEach(this.outageSettingObj, lang.hitch(this,
          function (widgetNode) {
            if (widgetNode) {
              overviewParam = widgetNode.getOverviewForm();
            }
          }));
        if (overviewParam.BufferDistance === 0 || overviewParam.BufferDistance <
          0 || overviewParam.BufferDistance === null || isNaN(
            overviewParam.BufferDistance) || overviewParam.BufferDistance ===
          undefined) {
          returnObj.returnFlag = true;
          returnObj.returnErr = this.nls.validationErrorMessage.BufferDisatanceOverview;

        } else if (overviewParam.MaxScale === null || isNaN(
            overviewParam.MaxScale) || overviewParam.MaxScale < 0) {
          returnObj.returnFlag = true;
          returnObj.returnErr = this.nls.validationErrorMessage.outputMaxScaleDataErr;

        } else if (overviewParam.MinScale === null || isNaN(
            overviewParam.MinScale) || overviewParam.MinScale < 0) {
          returnObj.returnFlag = true;
          returnObj.returnErr = this.nls.validationErrorMessage.outputMinScaleDataErr;
        } else if (overviewParam.saveToLayer !== "") {
          for (i = 0; i < overviewParam.fieldMap.length; i++) {
            if (fieldNameArr.length > 0 && fieldNameArr.indexOf(
                overviewParam.fieldMap[i].fieldName) !== -1) {
              returnObj.returnErr = this.nls.validationErrorMessage.outageFieldMappingErr;
              returnObj.returnFlag = true;
              break;
            }
            fieldNameArr.push(overviewParam.fieldMap[i].fieldName);

            if (paramNameArr.length > 0 && paramNameArr.indexOf(
                overviewParam.fieldMap[i].paramName) !== -1) {
              returnObj.returnErr = this.nls.validationErrorMessage.outageFieldMappingErr;
              returnObj.returnFlag = true;
              break;
            }
            paramNameArr.push(overviewParam.fieldMap[i].paramName);
          }
        }

      }

      return returnObj;
    },

    /**
    * This function display error message in jimu alert box.
    * @param {string} err gives the error message
    * @memberOf widgets/isolation-trace/settings/settings
    **/
    _errorMessage: function (err) {
      var errorMessage = new Message({
        message: err
      });
      errorMessage.message = err;
    }
  });
});