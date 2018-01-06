/*global define,dijit */
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
  "dojo/on",
  "dojo/_base/lang",
  "dojo/dom-construct",
  "dojo/query",
  "jimu/dijit/CheckBox",
  "dijit/form/Select",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dijit/form/NumberTextBox",
  "dojo/string"
], function (
  declare,
  on,
  lang,
  domConstruct,
  query,
  CheckBox,
  Select,
  domAttr,
  domClass,
  NumberTextBox,
  String
) {
  return declare(null, {
    _clickedRows: [], // store rows that are clicked.
    _dropDownArray: [], // stores Dropdown controls
    _initialLoad: false, // keeps tracks whether widget is initially loaded or not

    /**
    * This function is called when widget is constructed
    * @param {object} parameters passed to the widget
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    constructor: function (options) {
      lang.mixin(this, options);
    },

    /**
    * This function creates attribute parameter dataset to create UI
    * @param {object} response: service description of closest facility
    * @param {object} lookupValues: parameter lookup values
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    createAttributeParameterDataset: function (response, lookupValues) {
      var attributeNames, attributeParameters, m, apv, l,
        restAttrIndex;
      attributeNames = [];
      attributeParameters = [];
      for (m = 0; m < response.attributeParameterValues.length; m++) {
        if (response.attributeParameterValues[m].parameterName ===
          "Restriction Usage") {
          apv = {
            "attributeName": response.attributeParameterValues[m].attributeName,
            "type": "Restriction",
            "parameters": [{
              "name": response.attributeParameterValues[m].parameterName,
              "defaultValue": response.attributeParameterValues[
                m].value
            }]
          };
          for (l = 0; l < response.attributeParameterValues.length; l++) {
            if (response.attributeParameterValues[l].attributeName ===
              apv.attributeName && response.attributeParameterValues[
                l].parameterName !== "Restriction Usage") {
              apv.parameters.push({
                "name": response.attributeParameterValues[l].parameterName,
                "defaultValue": response.attributeParameterValues[
                  l].value
              });
            }
          }
          attributeParameters.push(apv);
          attributeNames.push(apv.attributeName);

        } else {
          restAttrIndex = attributeNames.indexOf(response.attributeParameterValues[
            m].attributeName);
          if (restAttrIndex < 0) {
            attributeParameters.push({
              "attributeName": response.attributeParameterValues[
                m].attributeName,
              "type": "",
              "parameters": [{
                "name": response.attributeParameterValues[m].parameterName,
                "defaultValue": response.attributeParameterValues[
                  m].value
              }]
            });
          }
        }

      }
      this._createAttrParamInput(attributeParameters, lookupValues);
    },

    /**
    * This function creates attribute parameters settings UI
    * @param {object} attributeParameters: attribute parameter dataset
    * @param {object} lookupValues: service description of closest facility
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createAttrParamInput: function (attributeParameters, lookupValues) {
      var i, j, attrParamValueContainer,
        esriCTAttrParamValueContainer, attrParamParent,
        configParameterObj, defaultToValueDropdown;
      esriCTAttrParamValueContainer = query(
        ".esriCTAttrParamContainer");
      if (esriCTAttrParamValueContainer.length > 0) {
        attrParamParent = esriCTAttrParamValueContainer[0];
        for (i = 0; i < attributeParameters.length; i++) {
          configParameterObj = null;
          defaultToValueDropdown = null;
          attrParamValueContainer = domConstruct.create("div", {
            "class": "esriCTparamaterwidth"
          }, attrParamParent);
          if (this.config && this.config.attributeName) {
            for (j = 0; j < this.config.attributeName.length; j++) {
              if (this.config.attributeName[j].name ===
                attributeParameters[i].attributeName) {
                configParameterObj = this.config.attributeName[j];
              }
            }
          }

          if (attributeParameters[i].type === "Restriction") {
            this._createRestrictionAttributeInput(
              attrParamValueContainer, attributeParameters[i],
              lookupValues, configParameterObj,
              defaultToValueDropdown);
          } else {
            this._createNonRestrictionAttributeInput(
              attrParamValueContainer, attributeParameters[i],
              configParameterObj,
              defaultToValueDropdown);
          }
        }
      }
    },

    /**
    * This function creates non restriction attribute parameter settings UI
    * @param {object} attrParamValueContainer: attribute parameter parent container
    * @param {object} attrParameter: restriction attribute object
    * @param {object} lookupValues: service description of closest facility
    * @param {object} configParameterObj: configuration parameter object of the attribute object
    * @param {object} defaultToValueDropdown: default to value drop down
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createNonRestrictionAttributeInput: function (
      attrParamValueContainer, attrParameter,
      configParameterObj, defaultToValueDropdown) {
      var attrNonRestrictionParamvalue, attributeParameterCheckBoxDiv,
        checkBox, attributenameLabelDiv,
        attrParamvalueDefaultDropDownContainer,
        attributeParameterDropDownColumn,
        minLabelDiv, minTextBoxDiv, minTextBox, maxLabelDiv,
        maxTextBoxDiv, maxTextBox, defaultInputValueDiv,
        defaultValueLabelDiv, defaultTextBoxDiv, defaultTextBox,
        userToInputValueDiv, parameterValues;

      attrNonRestrictionParamvalue = domConstruct.create("div", {
        "class": "esriCTNonRestriction"
      }, attrParamValueContainer);

      attributeParameterCheckBoxDiv = domConstruct.create("div", {
        "class": "esriCTNonRestrictionCheckBox esriCTParameterValueMargin"
      }, attrNonRestrictionParamvalue);
      checkBox = this._createAttributeCheckBox(attrParameter,
        attributeParameterCheckBoxDiv, attrParameter.parameters[0].name
      );

      domAttr.set(checkBox.domNode, "restrictionParameterName",
        attrParameter.parameters[0].name);
      domAttr.set(checkBox.domNode, "restrictionAttributeName",
        attrParameter.attributeName);

      attributenameLabelDiv = domConstruct.create("div", {
        "class": "esriCTAttrLabelWidth esriCTParameterValueMargin"
      }, attrNonRestrictionParamvalue);
      domConstruct.create("label", {
        "class": "",
        "title": attrParameter.parameters[0].name,
        "innerHTML": attrParameter.parameters[0].name
      }, attributenameLabelDiv);

      attrParamvalueDefaultDropDownContainer = domConstruct.create(
        "div", {
          "class": "esriCTNonRestriction esriCTParameterValueMargin esriCTAttrParamDisplay"
        }, attrNonRestrictionParamvalue);
      attributeParameterDropDownColumn = domConstruct.create("div", {
        "class": " esriCTAttrParamDropDown"
      }, attrParamvalueDefaultDropDownContainer);


      defaultToValueDropdown = this._createDefaultToValueDropDown(
        attributeParameterDropDownColumn, checkBox, attrParameter.parameters[
          0].name
      );

      //User input section
      userToInputValueDiv = domConstruct.create("div", {
        "class": "esriCTIndendedTextBoxMargin esriCTAttrParamDisplay"
      }, attrNonRestrictionParamvalue);

      minLabelDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign esriCTIndendedMinMargin esriCTMinMaxLabel"
      }, userToInputValueDiv);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.attributeParameter.minText,
        "innerHTML": this.nls.attributeParameter.minText
      }, minLabelDiv);
      minTextBoxDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign"
      }, userToInputValueDiv);
      minTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTNonRestrictionUserInputMargin",
        "name": "",
        "title": this.nls.attributeParameter.minText
      }, minTextBoxDiv);

      maxLabelDiv = domConstruct.create("div", {
        "class": "esriCTIndendedMaxMargin esriCTLeftAlign esriCTMinMaxLabel"
      }, userToInputValueDiv);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.attributeParameter.maxText,
        "innerHTML": this.nls.attributeParameter.maxText
      }, maxLabelDiv);
      maxTextBoxDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign"
      }, userToInputValueDiv);
      maxTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTNonRestrictionUserInputMargin",
        "name": "",
        "title": this.nls.attributeParameter.maxText
      }, maxTextBoxDiv);

      // for default value
      defaultInputValueDiv = domConstruct.create("div", {
        "class": "esriCTIndendedTextBoxMargin esriCTAttrParamDisplay"
      }, attrNonRestrictionParamvalue);
      defaultValueLabelDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign esriCTIndendedMinMargin esriCTValueLabel"
      }, defaultInputValueDiv);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.valueText,
        "innerHTML": this.nls.valueText
      }, defaultValueLabelDiv);
      defaultTextBoxDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign esriCTAttrParamDisplay"
      }, defaultInputValueDiv);
      defaultTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTNonRestrictionUserInputMargin",
        "name": "",
        "title": attrParameter.parameters[0].name
      }, defaultTextBoxDiv);
      defaultTextBox.set("value", attrParameter.parameters[0].defaultValue);

      //Select if attribute is already configured
      if (configParameterObj) {
        checkBox.setValue(true);

        if (defaultToValueDropdown) {
          this._setDropDownValue(defaultToValueDropdown,
            configParameterObj);
        }
        parameterValues = configParameterObj.parameters[0].value.split(
          ',');
        if (parameterValues.length > 1) {
          minTextBox.set("value", parameterValues[0]);
          maxTextBox.set("value", parameterValues[1]);
        } else if (parameterValues.length > 0) {
          defaultTextBox.set("value", parameterValues[0]);
        }
      }
    },

    /**
    * This function creates check box
    * @param {object} parentDiv: parent div to which checkbox to be added
    * @param {object} attrParameter: restriction attribute object
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createAttributeCheckBox: function (attrParameter, parentDiv,
      toolTip) {
      var checkBox, self = this;
      checkBox = new CheckBox({
        "name": attrParameter.attributeName,
        "title": toolTip,
        onChange: function () {
          self._showHideInputControls(this.domNode, this.getValue());
        }
      }, parentDiv);
      return checkBox;
    },

    /**
    * This function creates restriction attribute parameter settings UI
    * @param {object} attrParamValueContainer: attribute parameter parent container
    * @param {object} attrParameter: restriction attribute object
    * @param {object} lookupValues: service description of closest facility
    * @param {object} configParameterObj: configuration parameter object of the attribute object
    * @param {object} defaultToValueDropdown: default to value drop down
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createRestrictionAttributeInput: function (attrParamValueContainer,
      attrParameter, lookupValues, configParameterObj,
      defaultToValueDropdown) {
      var k, parameterConfigObj, attrParamvalueChildContainer,
        attributeParameterCheckBoxDiv, checkBox,
        attributenameLabelDiv, parameterLookupLabel,
        attrParamvalueDefaultDropDownContainer,
        attributeParameterDropDownColumn,
        attrParamvalueLookupContainer,
        attributeParameterValueDropDown, valueDropDown;
      attrParamvalueChildContainer = domConstruct.create("div", {
        "class": "esriCTRestriction"
      }, attrParamValueContainer);
      attributeParameterCheckBoxDiv = domConstruct.create("div", {
        "class": "esriCTParameterValueMargin"
      }, attrParamvalueChildContainer);
      checkBox = this._createAttributeCheckBox(attrParameter,
        attributeParameterCheckBoxDiv, attrParameter.attributeName);

      domAttr.set(checkBox.domNode, "restrictionParameterName",
        attrParameter.parameters[0].name);
      domAttr.set(checkBox.domNode, "restrictionAttributeName",
        attrParameter.attributeName);

      attributenameLabelDiv = domConstruct.create("div", {
        "class": "esriCTAttrLabelWidth esriCTParameterValueMargin"
      }, attrParamvalueChildContainer);
      domConstruct.create("label", {
        "class": "",
        "title": attrParameter.attributeName,
        "innerHTML": attrParameter.attributeName
      }, attributenameLabelDiv);

      attrParamvalueDefaultDropDownContainer = domConstruct.create(
        "div", {
          "class": "esriCTAttrParamDropDown esriCTParameterValueMargin esriCTAttrParamDisplay"
        }, attrParamvalueChildContainer);
      attributeParameterDropDownColumn = domConstruct.create("div", {
        "class": " "
      }, attrParamvalueDefaultDropDownContainer);


      defaultToValueDropdown = this._createDefaultToValueDropDown(
        attributeParameterDropDownColumn, checkBox, attrParameter.attributeName
      );
      attrParamvalueLookupContainer = domConstruct.create("div", {
        "class": " esriCTAttrParamDisplay"
      }, attrParamvalueChildContainer);
      parameterLookupLabel = domConstruct.create("div", {
        "class": "esriCTValueLabelMargin esriCTParameterValueMargin esriCTValueLabel"
      }, attrParamvalueLookupContainer);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.valueText,
        "innerHTML": this.nls.valueText
      }, parameterLookupLabel);
      attributeParameterValueDropDown = domConstruct.create("div", {
        "class": "esriCTParameterValueMargin  esriCTAttrParamValueDropDown "
      }, attrParamvalueLookupContainer);

      valueDropDown = new Select({
        "class": "defaultValueDropdown",
        "title": attrParameter.attributeName
      }, attributeParameterValueDropDown);
      domAttr.set(valueDropDown.domNode, "defaultValue",
        attrParameter.parameters[0].defaultValue);
      valueDropDown.startup();
      this._addValuesInDropDown(valueDropDown, lookupValues,
        attrParameter.parameters[0].defaultValue,
        configParameterObj);

      // if parameters are more than one
      if (attrParameter.parameters.length > 1) {
        for (k = 1; k < attrParameter.parameters.length; k++) {
          parameterConfigObj = configParameterObj ?
            configParameterObj.parameters[k] : null;
          this._createRestrictionParameterInput(
            attrParamValueContainer, attrParameter.parameters[k],
            parameterConfigObj);
        }
      }
      //Select if attribute is already configured
      if (configParameterObj) {
        checkBox.setValue(true);
        if (defaultToValueDropdown) {
          this._setDropDownValue(defaultToValueDropdown,
            configParameterObj);
        }
      }
    },

    /**
    * This function creates parameter input for non restriction usage parameter
    * @param {object} attrParamValueContainer: attribute parameter parent container
    * @param {object} parameter: parameter object
    * @param {object} configParameterObj: configuration parameter object of the attribute object
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createRestrictionParameterInput: function (attrParamValueContainer,
      parameter, parameterConfigObj) {
      var parameterValues, identedParameterContainer, indentedTextDiv,
        userToInputValueDiv, minLabelDiv, minTextBoxDiv,
        minTextBox, maxLabelDiv, maxTextBoxDiv, maxTextBox,
        defaultInputValueDiv, defaultTextBox;

      identedParameterContainer = domConstruct.create("div", {
        "class": "esriCTIndendedMargin esriCTAttrParamDisplay esriCTNRestriction"
      }, attrParamValueContainer);

      domAttr.set(identedParameterContainer,
        "restrictionParameterName", parameter.name);

      //parameter label
      indentedTextDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign esriCTIndendedTextAlign"
      }, identedParameterContainer);
      domConstruct.create("label", {
        "class": "",
        "title": parameter.name,
        "innerHTML": parameter.name
      }, indentedTextDiv);

      //User input section
      userToInputValueDiv = domConstruct.create("div", {
        "class": "esriCTIndendedTextBoxMargin",
        "title": parameter.name
      }, identedParameterContainer);

      minLabelDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign esriCTIndendedMinMargin esriCTMarginNR esriCTMinMaxLabel"
      }, userToInputValueDiv);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.attributeParameter.minText,
        "innerHTML": this.nls.attributeParameter.minText
      }, minLabelDiv);
      minTextBoxDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign"
      }, userToInputValueDiv);
      minTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTNonRestrictionUserInputMargin",
        "name": "",
        "title": this.nls.attributeParameter.minText
      }, minTextBoxDiv);

      maxLabelDiv = domConstruct.create("div", {
        "class": "esriCTIndendedMaxMargin esriCTLeftAlign esriCTMinMaxLabel"
      }, userToInputValueDiv);
      domConstruct.create("label", {
        "class": "",
        "title": this.nls.attributeParameter.maxText,
        "innerHTML": this.nls.attributeParameter.maxText
      }, maxLabelDiv);
      maxTextBoxDiv = domConstruct.create("div", {
        "class": "esriCTLeftAlign"
      }, userToInputValueDiv);
      maxTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTNonRestrictionUserInputMargin ",
        "name": "",
        "title": this.nls.attributeParameter.maxText
      }, maxTextBoxDiv);

      // for default value
      defaultInputValueDiv = domConstruct.create("div", {
        "class": "esriCTIndendedTextBoxMargin esriCTMarginNR esriCTMarginInded"
      }, identedParameterContainer);
      defaultTextBox = new NumberTextBox({
        "class": "esriCTLeftAlign esriCTIndendedTextBoxAlign",
        "name": "",
        "title": parameter.name
      }, defaultInputValueDiv);
      defaultTextBox.set("value", parameter.defaultValue);
      if (parameterConfigObj) {
        parameterValues = parameterConfigObj.value.split(',');
        if (parameterValues.length > 1) {
          minTextBox.set("value", parameterValues[0]);
          maxTextBox.set("value", parameterValues[1]);
        } else if (parameterValues.length > 0) {
          defaultTextBox.set("value", parameterValues[0]);
        }
      }
    },

    /**
    * This function is used to add options in drop downwhose selected value needs to be set
    * @param {object} drop down in which value needs to be added
    * @param {object} config parameter parameter
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _setDropDownValue: function (selectList, configParameterObj) {
      if (configParameterObj && configParameterObj.allowUserInput) {
        selectList.set("value", this.nls.allowToUserInput);
      }
    },

    /**
    * This function is used to add options in drop down
    * @param {object} drop down in which value needs to be added
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _addValuesInDropDown: function (valueDropDown, lookupValues,
      defaultValue, configParameterObj) {
      var i;
      valueDropDown.value = "";
      valueDropDown.options.length = 0;

      lookupValues = lookupValues.split(",");
      lookupValues = lookupValues.filter(function (n) {
        return n !== undefined && n !== "";
      });
      if (lookupValues.length > 0) {
        for (i = 0; i < lookupValues.length; i++) {
          if (i === 0) {
            valueDropDown.addOption({
              value: lookupValues[i],
              label: lookupValues[i],
              selected: true
            });
          } else {
            valueDropDown.addOption({
              value: lookupValues[i],
              label: lookupValues[i]
            });
          }
        }
        if (configParameterObj && configParameterObj.parameters &&
          configParameterObj.parameters[0].value) {
          valueDropDown.set("value", configParameterObj.parameters[0]
            .value);
        } else if (defaultValue && defaultValue !== "") {
          valueDropDown.set("value", defaultValue);
        }
      } else {
        valueDropDown.addOption({
          value: "",
          label: "",
          selected: true
        });
      }

    },

    /**
    * This function is used to refresh options in drop down
    * @param {object} drop down in which value needs to be added
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    refreshDefaultValueOptions: function (lookupValues) {
      var i, dropDownArray;
      dropDownArray = query(".defaultValueDropdown");
      for (i = 0; i < dropDownArray.length; i++) {
        this._addValuesInDropDown(dijit.byId(dropDownArray[i].id),
          lookupValues);
      }
    },

    /**
    * This function is used to create default to value drop down
    * @param {object} column in which drop down needs to be added
    * @param {object} data of parameters
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _createDefaultToValueDropDown: function (
      attributeParameterDropDownColumn, checkBox, toolTip
    ) {
      var select;
      select = new Select({
        "title": toolTip
      }, attributeParameterDropDownColumn);
      select.startup();
      select.addOption({
        value: this.nls.defaultToValue,
        label: this.nls.defaultToValue,
        selected: true
      });
      select.addOption({
        value: this.nls.allowToUserInput,
        label: this.nls.allowToUserInput
      });
      this._onDropDownChange(select, checkBox);
      return select;
    },

    /**
    * This function is used to show or hide the input controls
    * @param {object} checkBox that is checked/unchecked
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _showHideInputControls: function (checkBox, flag) {
      var i, existingRows, dropDownNode, selectdropDownNode;
      existingRows = checkBox.parentElement.parentElement.childNodes;
      dropDownNode = existingRows[0].childNodes[2];
      selectdropDownNode = query(".dijitSelect", dropDownNode)[0];
      if (!flag) {
        dijit.byId(selectdropDownNode.id).set("value", this.nls.defaultToValue);
      }
      if (!domClass.contains(existingRows[0].childNodes[0],
          "esriCTNonRestrictionCheckBox")) {
        if (flag) {
          if (existingRows) {
            for (i = 1; i < existingRows.length; i++) {
              domClass.remove(existingRows[i],
                "esriCTAttrParamDisplay");
              domClass.add(existingRows[i].childNodes[1],
                "esriCTAttrParamDisplay");
              domClass.remove(existingRows[i].childNodes[2],
                "esriCTAttrParamDisplay");
            }
            domClass.remove(checkBox.parentElement.childNodes[2],
              "esriCTAttrParamDisplay");
            domClass.remove(checkBox.parentElement.childNodes[3],
              "esriCTAttrParamDisplay");
          } else {
            domClass.remove(checkBox.parentElement.childNodes[2],
              "esriCTAttrParamDisplay");
            domClass.remove(checkBox.parentElement.childNodes[3],
              "esriCTAttrParamDisplay");
          }
        } else {
          if (existingRows) {
            for (i = 1; i < existingRows.length; i++) {
              domClass.add(existingRows[i], "esriCTAttrParamDisplay");
            }
            domClass.add(checkBox.parentElement.childNodes[2],
              "esriCTAttrParamDisplay");
            domClass.add(checkBox.parentElement.childNodes[3],
              "esriCTAttrParamDisplay");
          } else {
            domClass.add(checkBox.parentElement.childNodes[2],
              "esriCTAttrParamDisplay");
            domClass.add(checkBox.parentElement.childNodes[3],
              "esriCTAttrParamDisplay");
          }
        }
      } else {

        if (flag) {
          if (existingRows) {
            for (i = 0; i < existingRows.length; i++) {
              domClass.remove(existingRows[i].childNodes[2],
                "esriCTAttrParamDisplay");
              domClass.add(existingRows[i].childNodes[3],
                "esriCTAttrParamDisplay");
              domClass.remove(existingRows[i].childNodes[4],
                "esriCTAttrParamDisplay");
            }

          }
        } else {
          if (existingRows) {
            for (i = 0; i < existingRows.length; i++) {
              domClass.add(existingRows[i].childNodes[2],
                "esriCTAttrParamDisplay");
              domClass.add(existingRows[i].childNodes[3],
                "esriCTAttrParamDisplay");
              domClass.add(existingRows[i].childNodes[4],
                "esriCTAttrParamDisplay");
            }

          }
        }
      }
    },

    /**
    * This function is used to handle mouseup,click and change event of dropdown
    * @param {object} dropdown whose click & change event needs to be attached
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    _onDropDownChange: function (select, checkBox) {
      var columns, rows, self = this,
        i;
      on(select, 'change', function (value) {
        columns = this.domNode.parentElement.parentElement.childNodes;
        rows = this.domNode.parentElement.parentElement.parentElement
          .childNodes;
        if (columns && checkBox && checkBox) {
          if (!domClass.contains(columns[2],
              "esriCTNonRestriction")) {
            if (value === self.nls.allowToUserInput) {
              domClass.add(columns[3], "esriCTAttrParamDisplay");
              if (rows && rows.length > 0) {
                for (i = 1; i < rows.length; i++) {
                  domClass.remove(rows[i].childNodes[1],
                    "esriCTAttrParamDisplay");
                  domClass.add(rows[i].childNodes[2],
                    "esriCTAttrParamDisplay");
                }
              }
            } else {
              if (!domClass.contains(columns[2],
                  "esriCTAttrParamDisplay")) {
                domClass.remove(columns[3],
                  "esriCTAttrParamDisplay");
              }
              if (rows && rows.length > 0) {
                for (i = 1; i < rows.length; i++) {
                  domClass.add(rows[i].childNodes[1],
                    "esriCTAttrParamDisplay");
                  domClass.remove(rows[i].childNodes[2],
                    "esriCTAttrParamDisplay");
                }
              }
            }
          } else {
            if (value === self.nls.allowToUserInput) {
              domClass.add(columns[4], "esriCTAttrParamDisplay");
              domClass.remove(columns[3],
                "esriCTAttrParamDisplay");
            } else {
              domClass.add(columns[3], "esriCTAttrParamDisplay");
              if (!domClass.contains(columns[2],
                  "esriCTAttrParamDisplay")) {
                domClass.remove(columns[4],
                  "esriCTAttrParamDisplay");
              }
            }
          }
        }
      });
    },

    /**
    * This function is used to get configration of checked values
    * @return{array}: Selected attribute parameter list
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    getAttributeParameterConfiguration: function () {
      var attributeNameJsonArr, i, j, attributeName,
        attributeNameRows, parameter, queryResults, attrParamParent;
      attributeNameJsonArr = [];
      queryResults = query(".esriCTAttrParamContainer");
      attrParamParent = queryResults[0];
      for (i = 0; i < attrParamParent.childNodes.length; i++) {
        attributeName = {
          "allowUserInput": false,
          "type": "",
          "parameters": []
        };
        attributeNameRows = attrParamParent.childNodes[i].childNodes;
        if (domClass.contains(attributeNameRows[0].childNodes[0].childNodes[
            0], "checked")) {
          for (j = 0; j < attributeNameRows.length; j++) {
            //if 0 row then - it means not indented
            parameter = {
              "name": "",
              "value": ""
            };
            if (j === 0) {
              //set attribute name
              attributeName.name = domAttr.get(attributeNameRows[j].childNodes[
                0], "restrictionAttributeName");
              //set parameter name
              parameter.name = domAttr.get(attributeNameRows[j].childNodes[
                0], "restrictionParameterName");

              //if it is Restriction type
              if (domClass.contains(attributeNameRows[j],
                  "esriCTRestriction")) {
                attributeName.type = "Restriction";
                //it means allowUserInput is selected
                if (attributeNameRows[j].childNodes[2].textContent ===
                  this.nls.allowToUserInput) {
                  //set allowUserInput to true if it is selected in dropdown
                  attributeName.allowUserInput = true;
                  //set value for the parameter as prohibited
                  parameter.value = domAttr.get(attributeNameRows[j].childNodes[
                    3].childNodes[1], "defaultValue");
                } else {
                  //it means default to value is selected
                  parameter.value = attributeNameRows[j].childNodes[3]
                    .childNodes[1].textContent;
                }
              } else {
                if (attributeNameRows[j].childNodes[2].textContent ===
                  this.nls.allowToUserInput) {
                  //set allowUserInput to true if it is selected in dropdown
                  attributeName.allowUserInput = true;
                  //set value for the parameter as prohibited
                  parameter.value = attributeNameRows[j].childNodes[3]
                    .childNodes[1].childNodes[1].childNodes[0].value.replace(
                      /\,/g, '') + "," + attributeNameRows[j].childNodes[
                      3].childNodes[3].childNodes[1].childNodes[0].value
                    .replace(/\,/g, '');
                } else {
                  //it means default to value is selected
                  parameter.value = attributeNameRows[j].childNodes[4]
                    .childNodes[1].childNodes[1].childNodes[0].value.replace(
                      /\,/g, '');
                }
              }

            } else {
              //it means it is indented
              parameter.name = domAttr.get(attributeNameRows[j],
                "restrictionParameterName");
              if (attributeName.allowUserInput) {
                parameter.value = attributeNameRows[j].childNodes[1].childNodes[
                    1].childNodes[1].childNodes[0].value.replace(
                    /\,/g, '') + "," + attributeNameRows[j].childNodes[
                    1].childNodes[3].childNodes[1].childNodes[0].value
                  .replace(/\,/g, '');
              } else {
                parameter.value = attributeNameRows[j].childNodes[2].childNodes[
                  1].childNodes[0].value.replace(/\,/g, '');
              }
            }
            attributeName.parameters.push(parameter);
          }
          attributeNameJsonArr.push(attributeName);
        }
      }
      return attributeNameJsonArr;
    },

    /**
    * This function is used to get configration of checked values
    * @return{object}: return object of validation result indicating error and its messages
    * @memberOf widgets/ServiceFeasibility/settings/attribute-parameter
    **/
    ValidateNumericInputs: function () {
      var i, j, attributeNameRows, queryResults, attrParamParent,
        returnObj, parameterName, defaultValue,
        minValue, maxValue;
      returnObj = {
        returnErr: "",
        hasError: false
      };
      queryResults = query(".esriCTAttrParamContainer");
      attrParamParent = queryResults[0];
      for (i = 0; i < attrParamParent.childNodes.length; i++) {
        attributeNameRows = attrParamParent.childNodes[i].childNodes;
        if (domClass.contains(attributeNameRows[0].childNodes[0].childNodes[
            0], "checked")) {
          for (j = 0; j < attributeNameRows.length; j++) {
            parameterName = "";
            defaultValue = "";
            minValue = "";
            maxValue = "";
            if (j === 0) {
              if (!domClass.contains(attributeNameRows[j],
                  "esriCTRestriction")) {
                //Validate non restriction parameter values
                parameterName = domAttr.get(attributeNameRows[j].childNodes[
                  0], "restrictionParameterName");
                if (attributeNameRows[j].childNodes[2].textContent ===
                  this.nls.allowToUserInput) {
                  //Validate Min max value text boxes
                  minValue = attributeNameRows[j].childNodes[3].childNodes[
                    1].childNodes[1].childNodes[0].value.replace(
                    /\,/g, '');
                  maxValue = attributeNameRows[j].childNodes[3].childNodes[
                    3].childNodes[1].childNodes[0].value.replace(
                    /\,/g, '');
                  this._validateInput(minValue, parameterName,
                    returnObj, this.nls.validationErrorMessage.minValueErrorLabel
                  );
                  if (!returnObj.hasError) {
                    this._validateInput(maxValue, parameterName,
                      returnObj, this.nls.validationErrorMessage.maxValueErrorLabel
                    );
                    if (!returnObj.hasError) {
                      if (parseInt(minValue, 10) > parseInt(maxValue,
                          10)) {
                        returnObj.returnErr = parameterName + ":" +
                          this.nls.validationErrorMessage.minValueErr;
                        returnObj.hasError = true;
                        return returnObj;
                      }
                    } else {
                      return returnObj;
                    }
                  } else {
                    return returnObj;
                  }
                } else {
                  //Validate default value text box
                  defaultValue = attributeNameRows[j].childNodes[4].childNodes[
                    1].childNodes[1].childNodes[0].value.replace(
                    /\,/g, '');
                  this._validateInput(defaultValue, parameterName,
                    returnObj, this.nls.validationErrorMessage.defaultValueErrorLabel
                  );
                  if (returnObj.hasError) {
                    return returnObj;
                  }
                }
              }
            } else { //Validate restriction parameter values
              parameterName = domAttr.get(attributeNameRows[j],
                "restrictionParameterName");
              if (attributeNameRows[0].childNodes[2].textContent ===
                this.nls.allowToUserInput) {
                //Validate Min max value text boxes
                minValue = attributeNameRows[j].childNodes[1].childNodes[
                  1].childNodes[1].childNodes[0].value.replace(
                  /\,/g, '');
                maxValue = attributeNameRows[j].childNodes[1].childNodes[
                  3].childNodes[1].childNodes[0].value.replace(
                  /\,/g, '');
                this._validateInput(minValue, parameterName,
                  returnObj, this.nls.validationErrorMessage.minValueErrorLabel
                );
                if (!returnObj.hasError) {
                  this._validateInput(maxValue, parameterName,
                    returnObj, this.nls.validationErrorMessage.maxValueErrorLabel
                  );
                  if (!returnObj.hasError) {
                    if (parseInt(minValue, 10) > parseInt(maxValue,
                        10)) {
                      returnObj.returnErr = parameterName + ":" +
                        this.nls.validationErrorMessage.minValueErr;
                      returnObj.hasError = true;
                      return returnObj;
                    }
                  } else {
                    return returnObj;
                  }
                } else {
                  return returnObj;
                }
              } else {
                //Validate default text box
                defaultValue = attributeNameRows[j].childNodes[2].childNodes[
                  1].childNodes[0].value.replace(/\,/g, '');
                this._validateInput(defaultValue, parameterName,
                  returnObj, this.nls.validationErrorMessage.defaultValueErrorLabel
                );
                if (returnObj.hasError) {
                  return returnObj;
                }
              }
            }
          }
        }
      }
      return returnObj;
    },

    /**
    * This function is used to validate for numeric input and minimum and maximum validation
    * @memberOf widgets/ServiceFeasibility/settings/settings
    **/
    _validateInput: function (input, paramName, returnObj, valueType) {
      var regex;
      regex = /^[+\-]?\d*(?:\.\d{1,2})?$/; // allow only numbers [+/-] [0-9] upto 2 decimal
      if (input === "" || input === null) { //if minimum value is blank or null
        returnObj.returnErr = paramName + ":" + String.substitute(
          this.nls.validationErrorMessage.nullValueErr, [valueType]
        );
        returnObj.hasError = true;
      } else if (isNaN(parseInt(input, 10))) { //if minimum value is not a numeric value
        returnObj.returnErr = paramName + ":" + String.substitute(
          this.nls.validationErrorMessage.valueNumberOnlyErr, [
            valueType
          ]);
        returnObj.hasError = true;
      } else if (!regex.test(input)) { //Minimum value check with regex ^[+\-]?\d*(?:\.\d{1,2})?$,if it fails validation message will occur
        returnObj.returnErr = paramName + ":" + String.substitute(
          this.nls.validationErrorMessage.valueCharErr, [valueType]
        );
        returnObj.hasError = true;
      }
    }

  });
});