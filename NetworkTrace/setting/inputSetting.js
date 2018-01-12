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
  "dojo/on",
  "dojo/string",
  "esri/symbols/jsonUtils",
  "jimu/dijit/Popup",
  "./inputSymbolChooser",
  "dojo/_base/html",
  "jimu/symbolUtils",
  "dojo/text!./inputSetting.html",
  "dojo/text!./inputData.html",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin"
], function (
  declare,
  lang,
  domConstruct,
  on,
  string,
  jsonUtils,
  Popup,
  InputSymbolChooser,
  html,
  jimuSymUtils,
  inputSetting,
  inputDataString,
  _WidgetBase,
  _TemplatedMixin,
  _WidgetsInTemplateMixin
) {
  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    templateString: inputDataString,
    inputSettingString: inputSetting,
    popup: null,

    startup: function () {
      this.inherited(arguments);
    },

    postCreate: function () {
      this._createInputPanel();
    },

    /**
    * This function creates left title pane menu and binds the respective click events.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _createInputPanel: function () {
      var nlsTemp = string.substitute(this.inputSettingString, this);
      this.inputDataNode = domConstruct.toDom(nlsTemp).childNodes[0];
      on(this.inputDataNode, "click", lang.hitch(this, function () {
        this.inputFieldClicked(this);
      }));
      this.parentContainer.appendChild(this.inputDataNode);
      this._createInputDataPanel();
    },

    /**
    * This function handles input left menu panel click event.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    inputFieldClicked: function (widgetNode) { // jshint ignore:line
      return true;
    },

    /**
    * This function handles input Type change event
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    inputTypeChange: function (inputNode) { // jshint ignore:line
      return;
    },

    /**
    * This function creates input config parameters.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    getInputForm: function () {
      var inputParam = {
        "paramName": this.data.name,
        "displayName": this.data.displayName,
        "toolTip": this.inputTooltipData.value,
        "type": this.inputTypeData.value,
        "symbol": this.symbolJson
      };
      return inputParam;
    },

    /**
    * This function is called to display input task details.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _createInputDataPanel: function () {
      var i;
      this.inputTooltipData.id = "tooltipText_" + this.ObjId;
      // if input config object is not null
      if (this.inputConfig) {
        this.inputTooltipData.set("value", this.inputConfig.toolTip);
        // loop for setting the dropdown value as in available in config
        for (i = 0; i < this.inputTypeData.options.length; i++) {
          // if dropdown value in config is equal to the input drop down then
          if (this.inputTypeData.options[i].value === this.inputConfig
            .type) {
            this.inputTypeData.set("value", this.inputTypeData.options[
              i].value);
          }
        }
      } else {
        for (i = 0; i < this.inputTypeData.options.length; i++) {
          if (this.data.name.toString().toUpperCase().indexOf(this.inputTypeData.options[i].value.toString().toUpperCase()) >
            -1) {
            this.inputTypeData.set("value", this.inputTypeData.options[
              i].value);
          }
        }
      }
      on(this.inputTypeData, "Change", lang.hitch(this, function () {
        this.inputTypeChange(this);
      }));
      this._showSymbolChooser();
    },

    /**
    * This method creates and sets symbol for Symbol preview.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _showSymbolChooser: function () {
      var param, selectedSymbol, addSymbol;
      param = {
        "nls": this.nls,
        "data": this.data,
        "inputConfig": this.inputConfig
      };
      this.inputSymbolChooser = new InputSymbolChooser(param);
      this.own(on(this.symbolDataPreview, 'click', lang.hitch(this,
        this._chooseSymbolFromPopup)));
      // if input parameters configuration is available else set fall back symbol as Symbol
      if (this.inputConfig && this.inputConfig.symbol) {
        this.symbolJson = selectedSymbol = this.inputSymbolChooser.symbolChooser
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
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _getFallbackSymbol: function () {
      var jsonObj;
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
      return jsonObj;
    },

    /**
    * This method binds ok and click events on symbolChooser popup.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _bindPopupOkEvent: function () {
      var selectedSymbol, addSymbol;
      this.inputSymbolChooser.onOkClick = lang.hitch(this, function () {
        this.symbolJson = selectedSymbol = this.inputSymbolChooser
          .symbolChooser.getSymbol().toJson();
        if (this.inputConfig && this.inputConfig.symbol) {
          this.inputConfig.symbol = this.symbolJson;
        } else {
          var inputConfigObj = {};
          inputConfigObj.symbol = this.symbolJson;
          this.inputConfig = inputConfigObj;
        }
        addSymbol = this._createGraphicFromJSON(selectedSymbol);
        this._updatePreview(this.symbolDataPreview, addSymbol);
        this.popup.close();
      });
    },

    /**
    * This function will return the symbol as per the provided JSON.
    * @param{object} json: The JSON object from which symbol will be returned.
    * @return{object} symbol:Symbol can be simplefillsymbol, simplemarkersymbol, simplelinesymbol or picturemarkersymbol.
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _createGraphicFromJSON: function (json) {
      var symbol;
      symbol = jsonUtils.fromJson(json);
      return symbol;
    },

    /**
    * This method renders the selected symbol on symbol preview area.
    * @memberOf widgets/network-trace/settings/inputSetting
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
    * @memberOf widgets/network-trace/settings/inputSetting
    */
    _chooseSymbolFromPopup: function () {
      var param = {
        "nls": this.nls,
        "data": this.data,
        "inputConfig": this.inputConfig
      };
      this.inputSymbolChooser = new InputSymbolChooser(param);
      this.popup = new Popup({
        titleLabel: this.nls.symbolSelecter.selectSymbolLabel,
        width: 530,
        height: 400,
        content: this.inputSymbolChooser
      });
      this._bindPopupOkEvent();
    }

  });
});