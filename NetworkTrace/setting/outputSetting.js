/*global define */
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
  "dojo/_base/lang",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/query",
  "dojo/on",
  "dojo/dom-attr",
  "dojo/_base/html",
  "dojo/string",
  "esri/symbols/jsonUtils",
  "jimu/dijit/Popup",
  "./outputSymbolChooser",
  "jimu/symbolUtils",
  "dojo/text!./outputSetting.html",
  "dojo/text!./outputData.html",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin"
], function (
  declare,
  lang,
  domConstruct,
  domClass,
  query,
  on,
  domAttr,
  html,
  string,
  jsonUtils,
  Popup,
  OutputSymbolChooser,
  jimuSymUtils,
  outputSetting,
  outputDataString,
  _WidgetBase,
  _TemplatedMixin,
  _WidgetsInTemplateMixin
) {
  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    templateString: outputDataString,
    outputSettingString: outputSetting,
    outputSymbolChooser: null,
    popup: null,

    startup: function () {
      this.inherited(arguments);
    },

    postCreate: function () {
      this._createOutputPanel();
    },

    /**
    * This function creates left title pane menu and binds the respective click events.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    */
    _createOutputPanel: function () {
      var nlsTemp = string.substitute(this.outputSettingString, this);
      this.outputDataNode = domConstruct.toDom(nlsTemp).childNodes[0];
      on(this.outputDataNode, "click", lang.hitch(this, function () {
        this.outputFieldClicked(this);
      }));
      this.parentContainer.appendChild(this.outputDataNode);
      this._createOutputDataPanel();
    },

    /**
    * This function handles output left menu panel click event.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    */
    outputFieldClicked: function (widgetNode) { // jshint ignore:line
      return;
    },

    /**
    * This function creates output config parameters.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    */
    getOutputForm: function () {
      var bypassDetails, outputParam;
      bypassDetails = {
        "skipable": this.skippable.getValue() ? true : false,
        "IDField": this.skippable.getValue() ? this.inputTypeData.value : ""
      };
      outputParam = {
        "paramName": this.data.name,
        "type": "Result",
        "panelText": this.outputLabelData.value,
        "toolTip": this.outputTooltipData.value,
        "displayText": this.outputDisplayText.value,
        "MinScale": this.outputMinScaleData.value,
        "MaxScale": this.outputMaxScaleData.value,
        "exportToCSV": this.outputExport.getValue(),
        "saveToLayer": this.outputLayer.getValue() ? this.outputLayerType
          .value : "",
        "symbol": this.symbolJson
      };
      if (bypassDetails) {
        outputParam.bypassDetails = bypassDetails;
      }

      return outputParam;
    },

    /**
    * This function is called to display input task details.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    */
    _createOutputDataPanel: function () {
      var j, skippableFieldSelectArr, helpTextData;
      this.outageArea = {};

      this.outputLabelData.id = "outputLabelData_" + this.ObjId;

      skippableFieldSelectArr = this.data.defaultValue.fields;
      this.inputTypeData.startup();
      // if skippable dropdown is created then populates the web map list in dropdown options
      if (this.inputTypeData && skippableFieldSelectArr &&
        skippableFieldSelectArr.length > 0) {

        helpTextData = "";
        //this.outputSummaryHelpText.innerHTML = "";
        this.helpTextDataArray = [];
        helpTextData += "(";
        // Loop for populating the options in dropdown list
        for (j = 0; j < skippableFieldSelectArr.length; j++) {
          if (skippableFieldSelectArr[j].type === "esriFieldTypeOID") {
            continue;
          }
          this.inputTypeData.addOption({
            value: skippableFieldSelectArr[j].name,
            label: skippableFieldSelectArr[j].name,
            selected: false
          });
          this.helpTextDataArray.push(skippableFieldSelectArr[j].name);
          helpTextData += "{" + skippableFieldSelectArr[j].name;
          // if loop index is second last then
          if (j !== (skippableFieldSelectArr.length - 1)) {
            helpTextData += "}, ";
          } else {
            helpTextData += "}";
          }
        }
        helpTextData += ")";

        this.outputDisplayHelpText.innerHTML = helpTextData;
      }
      this.outputTooltipData.id = "tooltipText_" + this.ObjId;
      this.outputDisplayText.id = "displayText_" + this.ObjId;
      this.outputMinScaleData.id = "minScale_" + this.ObjId;
      this.outputMaxScaleData.id = "maxScale_" + this.ObjId;
      this.outputExport.id = "exportCSV_" + this.ObjId;
      this.outputLayer.id = "saveToLayer_" + this.ObjId;
      this._addSaveToLayerOptions();
      //this._createSymbolInput();
      this._showSymbolChooser();
      this.outageArea.isChecked = this.outputLayer.getValue();
      this.own(on(this.outputLayer.domNode, "click", lang.hitch(this,
        this._onLayerChange)));
      on(this.outputLayer.domNode, "click", lang.hitch(this, function () {
        this.layerChangeHandler(this);
      }));
      on(this.outputLayerType, "change", lang.hitch(this, function () {
        this.layerChangeHandler(this);
      }));
      this.outputLayerType.on('change', lang.hitch(this, function (evt) {
        this.outageArea.saveToLayer = evt;
        domAttr.set(this.outputLayer, "value", evt);
        this.outageArea.isChecked = this.outputLayer.getValue();
      }));
      setTimeout(lang.hitch(this, function () {
        this._setConfigParameters();
      }), 1000);
    },

    _addSaveToLayerOptions: function () {
      var n, operationalLayers;
      // save to Layer type Dropdown
      if (this.map && this.map.itemInfo && this.map.itemInfo.itemData &&
        this.map.itemInfo.itemData.operationalLayers) {
        this.outputLayerType.startup();
        operationalLayers = this.map.itemInfo.itemData.operationalLayers;
        // loop's populates Dropdown values
        for (n = 0; n < operationalLayers.length; n++) {
          // if layer type is feature Layer then
          if (operationalLayers[n].layerType && operationalLayers[n].layerType ===
            "ArcGISFeatureLayer" && operationalLayers[n].resourceInfo &&
            operationalLayers[n].resourceInfo.capabilities && this._validateLayerCapabilities(
              operationalLayers[n].resourceInfo.capabilities) && this
            .data.defaultValue.geometryType === operationalLayers[n].layerObject
            .geometryType) {
            // for first index of loop set default value
            if (n === 0) {
              this.outageArea.saveToLayer = operationalLayers[n].id;
              domAttr.set(this.outputLayer, "value",
                operationalLayers[n].id);
            }
            this.outputLayerType.addOption({
              value: operationalLayers[n].id,
              label: operationalLayers[n].title,
              selected: false
            });
          }
        }
      }
    },

    _validateLayerCapabilities: function (layerCapabilities) {
      // if layer has capability of create & update than return true
      if (layerCapabilities && layerCapabilities.indexOf("Create") >
        -1 && layerCapabilities.indexOf("Update") > -1) {
        return true;
      }
      // if layer has capability of create & editing than return true
      if (layerCapabilities && layerCapabilities.indexOf("Create") >
        -1 && layerCapabilities.indexOf("Editing") > -1) {
        return true;
      }
      return false;
    },

    /**
    * This method creates and sets symbol for Symbol preview.
    * @memberOf widgets/network-trace/settings/inputsetting
    */
    _showSymbolChooser: function () {
      var param, selectedSymbol, addSymbol;
      param = {
        "nls": this.nls,
        "data": this.data,
        "outputConfig": this.outputConfig,
        "outputParameterFlag": true
      };

      this.outputSymbolChooser = new OutputSymbolChooser(param);
      this.own(on(this.symbolDataPreview, 'click', lang.hitch(this,
        this._chooseSymbolFromPopup)));
      // if input parameters configuration is available else set fall back symbol as Symbol
      if (this.outputConfig && this.outputConfig.symbol) {
        this.symbolJson = selectedSymbol = this.outputSymbolChooser.symbolChooser
          .getSymbol().toJson();
        addSymbol = this._createGraphicFromJSON(selectedSymbol);
      } else {
        this.symbolJson = this._getFallbackSymbol();
        addSymbol = this._createGraphicFromJSON(this._getFallbackSymbol());
      }
      this._updatePreview(this.symbolDataPreview, addSymbol);
      this._bindPopupOkEvent();
    },

    /**
    * This method creates fall back symbol for Symbol preview.
    * @memberOf widgets/network-trace/settings/inputsetting
    */
    _getFallbackSymbol: function () {
      var jsonObj;
      switch (this.data.defaultValue.geometryType) {
        case "esriGeometryPoint":
          jsonObj = {
            "color": [0, 0, 128, 128],
            "outline": {
              "color": [0, 0, 128, 255],
              "width": 0.75,
              "type": "esriSLS",
              "style": "esriSLSSolid"
            },
            "size": 18,
            "type": "esriSMS",
            "style": "esriSMSCircle"
          };
          break;
        case "esriGeometryPolygon":
          jsonObj = {
            "color": [155, 187, 89, 129],
            "outline": {
              "color": [115, 140, 61, 255],
              "width": 1.5,
              "type": "esriSLS",
              "style": "esriSLSSolid"
            },
            "type": "esriSFS",
            "style": "esriSFSSolid"
          };
          break;
        case "esriGeometryPolyline":
          jsonObj = {
            "color": [155, 187, 89, 255],
            "type": "esriSLS",
            "style": "esriSLSSolid",
            "width": 2.25
          };
          break;
      }
      return jsonObj;
    },

    /**
    * This method binds ok and click events on symbolChooser popup.
    * @memberOf widgets/network-trace/settings/inputsetting
    */
    _bindPopupOkEvent: function () {
      var selectedSymbol, addSymbol;
      this.outputSymbolChooser.onOkClick = lang.hitch(this, function () {
        this.symbolJson = selectedSymbol = this.outputSymbolChooser
          .symbolChooser.getSymbol().toJson();
        if (this.outputConfig && this.outputConfig.symbol) {
          this.outputConfig.symbol = this.symbolJson;
        } else {
          var outputConfigObj = {};
          outputConfigObj.symbol = this.symbolJson;
          this.outputConfig = outputConfigObj;
        }
        addSymbol = this._createGraphicFromJSON(selectedSymbol);
        this._updatePreview(this.symbolDataPreview, addSymbol);
        this.popup.close();
      });
    },

    /**
    *This function will return the symbol as per the provided JSON.
    *@param{object} json: The JSON object from which symbol will be returned.
    *@return{object} symbol:Symbol can be simplefillsymbol, simplemarkersymbol, simplelinesymbol or picturemarkersymbol.
    **/
    _createGraphicFromJSON: function (json) {
      var symbol;
      symbol = jsonUtils.fromJson(json);
      return symbol;
    },

    /**
    * This method renders the selected symbol on symbol preview area.
    * @memberOf widgets/network-trace/settings/inputsetting
    */
    _updatePreview: function (previewNode, addSymbol) {
      var node = previewNode;
      html.empty(node);
      var symbolNode = jimuSymUtils.createSymbolNode(addSymbol);
      // if symbol node is not created
      if (!symbolNode) {
        symbolNode = html.create('div');
      }
      html.place(symbolNode, previewNode);
    },

    /**
    * This method creates symbolChooser and symbolChooser pop up instance.
    * @memberOf widgets/network-trace/settings/inputsetting
    */
    _chooseSymbolFromPopup: function () {
      var param = {
        "nls": this.nls,
        "data": this.data,
        "outputConfig": this.outputConfig,
        "outputParameterFlag": true
      };
      this.outputSymbolChooser = new OutputSymbolChooser(param);
      this.popup = new Popup({
        titleLabel: this.nls.symbolSelecter.selectSymbolLabel,
        width: 530,
        height: 400,
        content: this.outputSymbolChooser
      });
      this._bindPopupOkEvent();
    },

    _setConfigParameters: function () {
      var i;
      // if output config object is not null
      if (this.outputConfig) {
        this.outputLabelData.set("value", this.outputConfig.panelText);
        // if output config object is not null and bypass deatils available for outage area field mapping
        if (this.outputConfig && this.outputConfig.bypassDetails &&
          this.outputConfig.bypassDetails.skipable) {
          this.skippable.setValue(this.outputConfig.bypassDetails.skipable);
          //domClass.add(this.skippable.checkNode, "checked");
          domClass.remove(this.skippableDropdownDiv, "esriCTHidden");
          this.inputTypeData.set("value", this.outputConfig.bypassDetails
            .IDField);
        }

        this.outputTooltipData.set("value", this.outputConfig.toolTip);
        this.outputDisplayText.set("value", this.outputConfig.displayText);
        this.outputMinScaleData.set("value", ((this.outputConfig &&
            this.outputConfig.MinScale) ? this.outputConfig.MinScale :
          0));
        this.outputMaxScaleData.set("value", ((this.outputConfig &&
            this.outputConfig.MaxScale) ? this.outputConfig.MaxScale :
          0));
        // if exportToCSV is not null
        if (this.outputConfig.exportToCSV) {
          this.outputExport.setValue(this.outputConfig.exportToCSV);
          //domClass.add(this.outputExport.checkNode, "checked");
        }
        // loop for setting selected target Layer
        for (i = 0; i < this.outputLayerType.options.length; i++) {
          // if layers in dropdown is same as already the parameter that exist in the configuration
          if (this.outputLayerType.options[i].value === this.outputConfig
            .saveToLayer) {
            this.outputLayerType.set("value", this.outputLayerType.options[
              i].value);
          }
        }
        // validate whether save to layer parameter is available in configuration
        if (this.outputConfig.saveToLayer) {
          this.outputLayer.setValue(true);
          //domClass.add(this.outputLayer.checkNode, "checked");
          domClass.remove(this.selectOutputLayerType, "esriCTHidden");
        }
      }
      this.own(on(this.skippable.domNode, "click", lang.hitch(this,
        this._onSkipChange)));
    },

    /**
    * This function handles the on change and click events on skippable checkbox and dropdown.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    */
    layerChangeHandler: function () {
      return;
    },

    /**
    * This function is called to change the skippable status.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    **/
    _onSkipChange: function (evt) {
      var SkipChangeDiv;
      // if evt object and parent exist then toggle hide/show of skippable field dropdown
      if (evt && evt.currentTarget && evt.currentTarget.offsetParent &&
        evt.currentTarget.offsetParent.parentNode) {
        SkipChangeDiv = query(".skippableDropdownDiv", evt.currentTarget
          .offsetParent.parentNode);
        domClass.toggle(SkipChangeDiv[0], "esriCTHidden");
      }
    },

    /**
    * This function is called to change the save layer status.
    * @memberOf widgets/isolation-trace/settings/outputSetting
    **/
    _onLayerChange: function (evt) {
      var targetLayerDiv;
      this.outageArea.isChecked = this.outputLayer.getValue();
      // if evt object and parent exist then toggle hide/show of target layer dropdown
      if (evt && evt.currentTarget && evt.currentTarget.offsetParent &&
        evt.currentTarget.offsetParent.parentNode) {
        targetLayerDiv = query(".outputTargetLayer", evt.currentTarget
          .offsetParent.parentNode);
        domClass.toggle(targetLayerDiv[0], "esriCTHidden");
      }
    }
  });
});