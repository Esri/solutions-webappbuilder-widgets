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
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/_base/Color',
    'dojo/dom-style',
    'dojo/promise/all',
    'dojo/Deferred',
    'dojo/Evented',
    'dojo/on',
    'dojo/query',
    'dojo/dom-attr',
    'dojo/string',
    'dijit/form/Select',
    'dijit/form/ValidationTextBox',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/focus',
    './FieldPicker',
    'jimu/dijit/FeaturelayerChooserFromMap',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/Message',
    'jimu/dijit/Popup',
    'jimu/dijit/TabContainer3',
    'jimu/dijit/GpSource',
    'jimu/LayerInfos/LayerInfos',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dijit/registry',
    'jimu/dijit/ImageChooser',
    'jimu/portalUtils',
    'jimu/dijit/LayerChooserFromMapWithDropbox',
    'jimu/dijit/RadioBtn',
    'jimu/dijit/SimpleTable',
    'jimu/dijit/ColorPicker'
],
  function(
    declare, array, lang, Color, domStyle, all, Deferred, Evented, on, query, domAttr, string,
    Select, ValidationTextBox, _WidgetsInTemplateMixin, focusUtil,
    FieldPicker, FeatureLayerChooserFromMap, BaseWidgetSetting, Message, Popup, TabContainer3, GpSource,
    LayerInfos, domClass, domConstruct, registry, ImageChooser, portalUtils, LayerChooserFromMapWithDropbox
  ) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin, Evented], {

      baseClass: 'jimu-widget-SAT-setting',
      opLayers: [],
      curRow: null,
      validFields: [],
      saveValid: true,
      textValid: true,
      skipLayers: [],
      _selectedLayerIds: [],
      _allLayers: [],

      _highLightColor: '#0f96cc',

      postCreate: function() {
        this.inherited(arguments);
        this.updateTabs();
        this._initTabs();
        this._initReport();
        this.nls = lang.mixin(lang.mixin(this.nls, window.jimuNls.units), window.jimuNls.temperature);
        //this.chk_celsius.set('title', this.nls.celsius + "-" + this.nls.kilometers);
        //this.chk_celsius_label.innerHTML = this.nls.celsius + "-" + this.nls.kilometers;
        this._initLayerChooser();
        this.addSelectUnitOptions();
        this._getAllLayers();

        this.own(on(this.tabTable, 'actions-edit', lang.hitch(this, this._onEditLayerClicked)));
        this.own(on(this.tabTable, 'row-delete', lang.hitch(this, this._rowDeleted)));
        this.own(on(this.tabTable, 'row-up', lang.hitch(this, this._moveRow, true)));
        this.own(on(this.tabTable, 'row-down', lang.hitch(this, this._moveRow, false)));

        this.tabTable.onBeforeRowDelete = lang.hitch(this, this._onBeforeDelete);

        this._addValidator(this.incident_label, this.checkSmallString);
        this._addValidator(this.locate_incident_label, this.checkLargeString);
        this._addValidator(this.buffer_lbl, this.checkLargeString);
      },

      _initLayerChooser: function () {
        this._selectedLayerIds = [];
        this._allLayers = [];

        this.layerChooserFromMap = new FeatureLayerChooserFromMap({
          multiple: false,
          showLayerFromFeatureSet: false,
          showTable: false,
          onlyShowVisible: false,
          createMapResponse: this.map.webMapResponse
        });
        this.layerChooserFromMap.startup();

        var layerInfosArray = this.layerChooserFromMap.layerInfosObj.getLayerInfoArray();

        var defList = [];
        this._getAllFilteredLayers(layerInfosArray, defList);

        all(defList).then(lang.hitch(this, function () {
          if (this._allLayers.length > 0) {
            this.own(on(this.btnAddTab, 'click', lang.hitch(this, this._addTabRow)));
          } else {
            domStyle.set(this.btnAddTab, "display", "none");
            domStyle.set(this.tabOptionsTab, "margin-top", "10px");
            new Message({
              message: this.nls.missingLayerInWebMap
            });
            this.noValidLayers = true;
            return;
          }
        }));
      },

      _getAllFilteredLayers: function (layerInfosArray, defList) {
        array.forEach(layerInfosArray, lang.hitch(this, function (currentLayer) {
          var layerDef;
          if (!currentLayer.isLeaf()) {
            this._getAllFilteredLayers(currentLayer.newSubLayers, defList);
          }
          else {
            layerDef = new Deferred();
            this.layerChooserFromMap.filter(currentLayer).then(
              lang.hitch(this, function (isValid) {
                if (isValid) {
                  this._allLayers.push(currentLayer);
                }
                layerDef.resolve();
              }));
            defList.push(layerDef);
          }
        }));
      },

      updateTabs: function () {
        if (this.config && this.config.tabs && this.config.tabs.length) {
          var tabs = this.config.tabs;
          for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            if (tab.type && tab.type === 'weather') {
              tabs.splice(i, 1);
            }
          }
        }
      },

      _addValidator: function (n, f) {
        n.invalidMessage = this.nls.invalid_string_width;
        n.validator = lang.hitch(this, f, n);
      },

      //_initWeather: function () {
      //  this._addMapWeatherLayersSelect();
      //},

      //_addMapWeatherLayersSelect: function () {
      //  this.chk_weather.onChange = lang.hitch(this, function (v) {
      //    this._updateDisplay(this.selectMapWeatherLayers, v);
      //    this._updateDisplay(this.chkCelsius, v);
      //  });

      //  var opLayers = this.layer_options;
      //  var options = [];

      //  if (opLayers.length === 0) {
      //    new Message({
      //      message: this.nls.missingLayerInWebMap
      //    });
      //  }

      //  this.mapWeatherLayersSelect = new LayerCheckedMultiSelect({
      //    name: "selectMapWeatherLayers",
      //    multiple: true,
      //    dropDown: true,
      //    style: "width:100%;",
      //    label: this.nls.weather_map_layers,
      //    nlsValue: this.nls.selected_map_layers,
      //    required: false
      //  }).placeAt(this.selectMapWeatherLayers);
      //  this.mapWeatherLayersSelect.on('click', lang.hitch(this, function (evt) {
      //    if (evt.target.nodeName === "INPUT") {
      //      this.mapWeatherLayersSelect.dropDownButton.toggleDropDown();
      //    }
      //  }));

      //  this.mapWeatherLayersSelect.startup();

      //  /*jshint loopfunc: true */
      //  for (var i = 0; i < opLayers.length; i++) {
      //    var filteredArr = array.filter(options, function (item) {
      //      return item.label === opLayers[i].label;
      //    });
      //    if (filteredArr === null || filteredArr.length === 0) {
      //      this.mapWeatherLayersSelect.addOption({
      //        label: opLayers[i].label,
      //        value: opLayers[i].label,
      //        id: opLayers[i].value
      //      });
      //    }
      //  }
      //},

      //_getSelectedLayers: function (options) {
      //  var layers = [];
      //  array.forEach(options, lang.hitch(this, function (option) {
      //    if (option.selected) {
      //      layers.push(option);
      //    }
      //  }));
      //  return layers;
      //},

      _initReport: function () {
        this.chk_report.onChange = lang.hitch(this, function (v) {
          this._updateDisplay(this.reportSettingsDiv, v);
        });

        this._setPrintTaskURL();
        this._setFootnote();
        this._setReportTextColor();

        // Attach Report GP Service set button event
        this.own(on(this.printGPServiceSetButton, "click", lang.hitch(this, function () {
          var printReportGPSource = new GpSource({
            portalUrl: this.appConfig.portalUrl
          });
          var popup = this._onSetButtonClick(printReportGPSource);
          this._attachPrintReportGPSourceEvents(printReportGPSource, popup);
        })));
        // Initialize jimu dijit image chooser
        this._initImageChooser();
      },

      _setPrintTaskURL: function () {
        // Set print report gp service url
        if (this.reportSettings && this.reportSettings.printTaskURL &&
          this.reportSettings.printTaskURL !== "") {
          this.printGPServiceTextBox.set("value", this.reportSettings.printTaskURL);
          this._printTaskURL = this.reportSettings.printTaskURL;
        } else {
          //get helper services form portal object and discover print task url form org info
          var helperServices = portalUtils.getPortal(this.appConfig.portalUrl).helperServices;
          if (helperServices && helperServices.printTask.url) {
            this.printGPServiceTextBox.set("value", helperServices.printTask.url);
            this._printTaskURL = helperServices.printTask.url;
          }
        }
      },

      _setFootnote: function () {
        // Set print report footnote
        if (this.reportSettings && this.reportSettings.footnote &&
          this.reportSettings.footnote !== "") {
          this.footnoteTextArea.value = this.reportSettings.footnote;
        }
      },

      _setReportTextColor: function () {
        if (this.reportSettings && this.reportSettings.textColor) {
          this.colorPicker.setColor(new Color(this.reportSettings.textColor));
        }
      },

      addSelectUnitOptions: function () {
        this.selectUnits.addOption([{
          label: this.nls.miles,
          value: "miles",
          selected: true
        }, {
          label: this.nls.kilometers,
          value: "kilometers",
          selected: false
        }, {
          label: this.nls.feet,
          value: "feet",
          selected: false
        }, {
          label: this.nls.meters,
          value: "meters",
          selected: false
        }, {
          label: this.nls.yards,
          value: "yards",
          selected: false
        }, {
          label: this.nls.nauticalMiles,
          value: "nauticalMiles",
          selected: false
        }]);
      },

      startup: function() {
        this.inherited(arguments);
      },

      _initTabs: function () {
        this._tabsContainer = new TabContainer3({
          tabs: [{
            title: this.nls.tab_options,
            content: this.tabOptionsTab
          }, {
            title: this.nls.export_options,
            content: this.exportOptionsTab
          }]
        }, this.tabContainer);
        this.own(on(this._tabsContainer, "tabChanged", lang.hitch(this, function () {
          this._tabsContainer.containerNode.scrollTop = 0;
        })));
        this._tabsContainer.startup();
      },

      setConfig: function(config) {
        this.config = config;

        if (this.config.distanceUnits) {
          this.selectUnits.set("value", this.config.distanceUnits);
        }

        if (this.config.maxDistance) {
          this.txt_maximumDistance.set("value", this.config.maxDistance);
        }

        if (this.config.enableRouting) {
          this.chk_routing.set('value', true);
        }

        this.tabTable.clear();
        //var weatherEnabled = false;
        for (var i = 0; i < this.config.tabs.length; i++) {
          var aTab = this.config.tabs[i];
          //if (aTab.type === this.config.special_layer.value) {
          //  this.chk_weather.set('value', true);
          //  weatherEnabled = true;
          //  var weatherLayers = (aTab.layers && aTab.layers.split) ? aTab.layers.split(',') : [];
          //  var _weatherLayers = [];
          //  if (aTab.mapLayers) {
          //    /*jshint loopfunc: true */
          //    array.forEach(aTab.mapLayers, function (ml) {
          //      if (weatherLayers.indexOf(ml.value) > -1 || weatherLayers.indexOf(ml.id) > -1) {
          //        _weatherLayers.push(ml.value);
          //      }
          //    });
          //  } else {
          //    _weatherLayers = weatherLayers;
          //  }
          //  this.mapWeatherLayersSelect.set("value", _weatherLayers);
          //  this._setSelectedLayers(this.mapWeatherLayersSelect, _weatherLayers);
          //} else {
          this._populateTabTableRow(aTab);
          //}
        }
        //this._updateDisplay(this.selectMapWeatherLayers, weatherEnabled);
        //this._updateDisplay(this.chkCelsius, weatherEnabled);

        //if (this.config.celsius) {
        //  this.chk_celsius.set('value', true);
        //}

        this.incident_label.set("value", this.config.incidentLabel ?
          this.config.incidentLabel : this.nls.incident);

        this.locate_incident_label.set("value", this.config.locateIncidentLabel ?
          this.config.locateIncidentLabel : this.nls.locate_incident);

        this.buffer_lbl.set("value", this.config.bufferLabel ?
          this.config.bufferLabel : this.nls.buffer_value);

        this.buffer_max.set("value", this.config.bufferRange.maximum);
        this.buffer_min.set("value", this.config.bufferRange.minimum);

        if (this.config.disableVisibilityManagement) {
          this.chk_visibility.set('value', true);
        }

        if (this.config.saveEnabled && typeof (this.config.savePolys) === 'undefined' &&
          typeof (this.config.saveLines) === 'undefined' && typeof (this.config.savePoints) === 'undefined') {
          this.config.savePolys = true;
          this.config.polyEditLayer = this.config.editLayer;
        }

        var hasEditableLayers = false;

        var hasEditablePointLayers = this._updateEditUI(this.save_point_layers, this.chk_point_save,
          this.div_selectPointSaveLayer, this.config.savePoints, this.selectPointSaveLayer,
          this.config.pointEditLayer);
        hasEditableLayers = hasEditablePointLayers ? true : hasEditableLayers;

        var hasEditableLineLayers = this._updateEditUI(this.save_line_layers, this.chk_line_save,
          this.div_selectLineSaveLayer, this.config.saveLines, this.selectLineSaveLayer,
          this.config.lineEditLayer);
        hasEditableLayers = hasEditableLineLayers ? true : hasEditableLayers;

        var hasEditablePolyLayers = this._updateEditUI(this.save_poly_layers, this.chk_poly_save,
          this.div_selectPolySaveLayer, this.config.savePolys, this.selectPolySaveLayer,
          this.config.polyEditLayer);
        hasEditableLayers = hasEditablePolyLayers ? true : hasEditableLayers;

        if (!hasEditableLayers) {
          this.chk_save.set("disabled", 'disabled');
          this._updateDisplay(this.editOptions, false);
        } else {
          this.chk_save.onChange = lang.hitch(this, function (v) {
            this._updateDisplay(this.editOptions, v);
          });
          this.chk_save.set("checked", this.config.saveEnabled);
          this._updateDisplay(this.editOptions, this.config.saveEnabled);
          if (this.config.saveEnabled && this.config.editTemplate) {
            //checking this to persist saved template for backwards compatability
            // after November we will no longer be persisting these details in the config
            this.selectedTemplate = this.config.editTemplate;
            if (typeof (this.config.selectedTemplateIndex) !== 'undefined') {
              this.selectedTemplateIndex = this.config.selectedTemplateIndex;
            }
          }
        }

        this.chk_csv.set("checked", this.config.csvAllFields);
        this.chk_display.set("checked", this.config.summaryDisplayEnabled);

        //Snapshot settings
        this.chk_snapshot.set("checked", this.config.snapshotEnabled || false);

        //Report Settings
        this.chk_report.set("checked", this.config.reportEnabled || false);
        this._updateDisplay(this.reportSettingsDiv, this.config.reportEnabled || false);
        this.reportSettings = this.config.reportSettings;
        this._setPrintTaskURL();
        this._setFootnote();
        this._setReportTextColor();
        this._createLogoPreview();

        if (this.noValidLayers) {
          this._disableOk();
        }
      },

      _updateEditUI: function (editLayers, cb, div, configOpt, select, configLayer) {
        var hasEditableLayers = false;
        if (typeof (editLayers) !== 'undefined' && editLayers.length > 0) {
          hasEditableLayers = true;
          cb.onChange = lang.hitch(this, function (v) {
            this._updateDisplay(div, v);
          });
          select.addOption(editLayers);
          var saveEnabled = false;
          if (typeof (configOpt) !== 'undefined') {
            saveEnabled = configOpt;
            if (saveEnabled) {
              select.set("value", configLayer);
            }
          }
          cb.set('checked', saveEnabled);
          this._updateDisplay(div, saveEnabled);
        } else {
          cb.set('disabled', true);
          cb.set('checked', false);
          this._updateDisplay(div, false);
        }
        return hasEditableLayers;
      },

      _updateDisplay: function (attachPoint, v) {
        if (domClass.contains(attachPoint, v ? 'display-off' : 'display-on')) {
          domClass.remove(attachPoint, v ? 'display-off' : 'display-on');
        }
        domClass.add(attachPoint, v ? 'display-on' : 'display-off');
        this.saveValid = this._validateSave();
        if (this.saveValid && this._validateRows() && this.textValid) {
          this._enableOk();
        } else {
          this._disableOk();
        }
      },

      _validateRows: function () {
        var isValid = true;
        var rows = this.tabTable.getRows();
        array.forEach(rows, function (row) {
          isValid = row.isValid === false ? row.isValid : isValid;
        });
        return isValid;
      },

      _validateSave: function(){
        var valid = false;
        if(this.chk_save.checked){
          if(this.chk_point_save.checked || this.chk_line_save.checked || this.chk_poly_save.checked){
            valid = true;
          }
        }else{
          valid = true;
        }
        return valid;
      },

      getConfig: function() {
        var tabs = [];

        var aTab = {};
        //if (this.chk_weather.checked) {
        //  aTab.label = this.config.special_layer.label;
        //  aTab.type = this.config.special_layer.value;
        //  aTab.url = this.config.special_layer.url;
        //  aTab.mapLayers = this.mapWeatherLayersSelect !== this.nls.selected_map_layers ?
        //    this._getSelectedLayers(this.mapWeatherLayersSelect.options) : [];
        //  var _layers = [];
        //  array.forEach(aTab.mapLayers, function (ml) {
        //    _layers.push(ml.id);
        //  });
        //  aTab.layers = _layers.join(",");
        //  aTab.layerTitle = true;
        //  tabs.push(aTab);
        //}

        var trs = this.tabTable.getRows();
        array.forEach(trs, lang.hitch(this, function(tr) {
          var selectLayers = tr.selectLayers;
          var selectTypes = tr.selectTypes;
          var labelText = tr.labelText;
          var item = selectLayers.getSelectedItem();
          aTab = {};
          aTab.label = labelText.value;
          aTab.type = selectTypes.value;
          aTab.layerTitle = item.layerInfo.title;
          aTab.layers = item.layerInfo.id;
          if(tr.tabInfo && tr.tabInfo.advStat) {
            aTab.advStat = tr.tabInfo.advStat;
          } else {
            //set default
            if (tr.validFields) {
              var fp = new FieldPicker({
                test: true,
                nls: this.nls
              });
              aTab.advStat = fp.getDefaultFields(tr.validFields.popUpFields,
                tr.validFields.validSummaryFields, selectTypes.value);
            }
          }
          tabs.push(aTab);
        }));

        this.config.tabs = tabs;

        this.config.incidentLabel = this.incident_label.value;
        this.config.locateIncidentLabel = this.locate_incident_label.value;
        this.config.bufferLabel = this.buffer_lbl.value;
        this.config.bufferRange.maximum = this.buffer_max.value;
        this.config.bufferRange.minimum = this.buffer_min.value;
        this.config.distanceUnits = this.selectUnits.value;
        //this.config.celsius = this.chk_celsius.checked;
        this.config.disableVisibilityManagement = this.chk_visibility.checked;
        this.config.enableRouting = this.chk_routing.checked;
        this.config.saveEnabled = this.chk_save.checked;
        this.config.savePoints = this.chk_point_save.checked;
        if (this.config.savePoints) {
          this.config.pointEditLayer = this.selectPointSaveLayer.value;
        }
        this.config.saveLines = this.chk_line_save.checked;
        if (this.config.saveLines) {
          this.config.lineEditLayer = this.selectLineSaveLayer.value;
        }
        this.config.savePolys = this.chk_poly_save.checked;
        if (this.config.savePolys) {
          this.config.polyEditLayer = this.selectPolySaveLayer.value;
        }

        if (this.txt_maximumDistance.value) {
          this.config.maxDistance = this.txt_maximumDistance.value;
        }


        this.config.csvAllFields = this.chk_csv.checked;
        this.config.summaryDisplayEnabled = this.chk_display.checked;
        this.config.snapshotEnabled = this.chk_snapshot.checked;
        this.config.reportEnabled = this.chk_report.checked;
        this.config.reportSettings = {
          printTaskURL: this.getPrintReportGPServiceURL(),
          footnote: this.getFootnoteForReport(),
          logo: this.getLogo(),
          textColor: this.colorPicker.getColor().toHex()
        };

        return this.config;
      },

      _getAllLayers: function() {
        if (this.map.itemId) {
          LayerInfos.getInstance(this.map, this.map.itemInfo)
            .then(lang.hitch(this, function(operLayerInfos) {
              this.opLayers = operLayerInfos;
              this._setLayers();
              this._setTypes();
              //this._initWeather();
              this.setConfig(this.config);
            }));
        }
      },

      _setLayers: function () {
        var options = [];
        var pointSaveOptions = [];
        var lineSaveOptions = [];
        var polySaveOptions = [];
        this.skipLayers = [];
        array.forEach(this.opLayers._layerInfos, lang.hitch(this, function (OpLyr) {
          if (OpLyr.newSubLayers.length > 0) {
            this._recurseOpLayers(OpLyr.newSubLayers, options, pointSaveOptions, lineSaveOptions, polySaveOptions);
          } else {
            var skipLayer = this._checkSkipLayer(OpLyr);
            if (!skipLayer) {
              options.push({
                label: OpLyr.title,
                value: OpLyr.id
              });

              if (OpLyr.layerObject) {
                this._updateEditOptions(OpLyr, pointSaveOptions, lineSaveOptions, polySaveOptions);
              }
            }
          }
        }));

        if (this.skipLayers.length > 0) {
          var msg = "";
          array.forEach(this.skipLayers, function (l) {
            //TODO update nls for 5.4
            var _type = l.type === 'collection' ? 'Feature Collection' : l.type;
            msg += "Layer Name: " + l.name + "\r\nLayer Type: " + _type + "\r\n\r\n";
          });

          new Message({
            titleLabel: this.nls.layer_type_not_supported,
            message: "<div style='max-height: 500px; overflow: auto;'>" + msg + "</div>",
            maxWidth: 450
          });
        }

        this.layer_options = lang.clone(options);
        this.checkFields();
        //save_layer_options becomes:
        this.save_point_layers = lang.clone(pointSaveOptions);
        this.save_line_layers = lang.clone(lineSaveOptions);
        this.save_poly_layers = lang.clone(polySaveOptions);
      },

      checkFields: function () {
        this.validFields = [];
        var fp;
        for (var i = 0; i < this.layer_options.length; i++) {
          var l = this.layer_options[i];
          fp = new FieldPicker({
            nls: this.nls,
            callerLayer: l.value,
            callerOpLayers: this.opLayers._layerInfos,
            map: this.map,
            test: true,
            callerTab: {
              type: 'closest'
            }
          });
          fp._validatePopupFields().then(lang.hitch(this, function (validFields) {
            this.validFields.push(validFields);
          }));
        }
      },

      _recurseOpLayers: function (opLyrs, options, pointSaveOptions, lineSaveOptions, polySaveOptions) {
        array.forEach(opLyrs, lang.hitch(this, function (opLyr) {
          if (opLyr.newSubLayers.length > 0) {
            this._recurseOpLayers(opLyr.newSubLayers, options, pointSaveOptions, lineSaveOptions, polySaveOptions);
          } else {
            var skipLayer = this._checkSkipLayer(opLyr);
            if (!skipLayer) {
              options.push({
                label: opLyr.title,
                value: opLyr.id
              });
              if (opLyr.layerObject) {
                this._updateEditOptions(opLyr, pointSaveOptions, lineSaveOptions, polySaveOptions);
              }
            }
          }
        }));
      },

      _checkSkipLayer: function (opLyr) {
        var supportedLayerTypes = ["ArcGISFeatureLayer", "ArcGISMapServiceLayer", "Feature Layer"];
        var skipLayer = false;

        if (opLyr.layerObject) {
          if (opLyr.layerObject.hasOwnProperty('tileInfo')) {
            skipLayer = true;
          }
          if (opLyr.layerObject.url && (opLyr.layerObject.url.indexOf('ImageServer') > -1 ||
            opLyr.layerObject.url.indexOf('.csv') > -1)) {
            skipLayer = true;
          }
          if (opLyr.layerObject.type && supportedLayerTypes.indexOf(opLyr.layerObject.type) === -1) {
            skipLayer = true;
          }
          if (!opLyr.layerObject.url) {
            skipLayer = true;
          }
        }
        if (skipLayer) {
          this.skipLayers.push({
            name: opLyr.title,
            type: (opLyr.originOperLayer && opLyr.originOperLayer.selfType) ?
              opLyr.originOperLayer.selfType : (opLyr.originOperLayer && opLyr.originOperLayer.type) ?
                opLyr.originOperLayer.type : opLyr.layerObject.type
          });
        }
        return skipLayer;
      },

      _updateEditOptions: function (opLyr, pointSaveOptions, lineSaveOptions, polySaveOptions) {
        var lo = opLyr.layerObject;
        var cb = lo.capabilities;
        var sa;
        if (cb && cb.indexOf("Edit") > 0 || cb && cb.indexOf("Create") > 0) {
          if (opLyr.controlPopupInfo && opLyr.controlPopupInfo.enablePopup) {
            if (lo.geometryType === 'esriGeometryPoint') {
              sa = pointSaveOptions;
            } else if (lo.geometryType === 'esriGeometryPolyline') {
              sa = lineSaveOptions;
            } else if (lo.geometryType === 'esriGeometryPolygon') {
              sa = polySaveOptions;
            }
            if (typeof (sa) !== 'undefined') {
              sa.push({
                label: opLyr.title,
                value: opLyr.id,
                selected: false
              });
            }
          }
        }
      },

      _setTypes: function() {
        this.analysis_options = [{
          value: 'closest',
          label: this.nls.closest
        }, {
          value: 'proximity',
          label: this.nls.proximity
        }, {
          value: 'summary',
          label: this.nls.summary
        }, {
          value: 'groupedSummary',
          label: this.nls.groupedSummary
        }];
      },

      _populateTabTableRow: function(tabInfo) {
        var result = this.tabTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          tr.tabInfo = tabInfo;
          this._addTabLayers(tr);
          this._addTabTypes(tr);
          this._addTabLabel(tr);
          //for BC after the title/id switch
          //layerTitle is only set for configs after this change...old configs will not have it
          var id = typeof (tabInfo.layerTitle) !== 'undefined' ? tabInfo.layers : this.getLayerID(tabInfo.layers);
          if (!this.layerExists(tr.selectLayers.options, tabInfo)) {
            //tr.selectLayers.addOption({
            //  label: typeof (tabInfo.layerTitle) !== 'undefined' ? tabInfo.layerTitle : tabInfo.layers,
            //  value: tabInfo.layers,
            //  disabled: 'disabled'
            //});
            tr.selectLayers.invalidValues.push(tabInfo.layers);
          }
          var layerInfo = this.opLayers.getLayerInfoById(id);
          if (layerInfo) {
            layerInfo.getLayerObject().then(lang.hitch(this, function (layer) {
              tr.selectLayers.setSelectedLayer(layer);
            }));
          }

          tr.selectTypes.set("value", tabInfo.type, false);
          tr.type = tabInfo.type;
          tr.labelText.set("value", tabInfo.label);
        }
      },

      getLayerID: function(title){
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (title === lo.label || title === lo.value) {
            return lo.value;
          }
        }
      },

      _onBeforeDelete: function (row) {
        this._selectedLayerIds.splice(row.rowIndex, 1);
        return true;
      },

      _rowDeleted: function (row) {
        if (row.selectLayers) {
          row.selectLayers.destroy();
        }

        var trs = this.tabTable.getRows();
        var allValid = true;
        for (var i = 0; i < trs.length; i++) {
          if (!trs[i].isValid) {
            allValid = false;
            break;
          }
        }
        var s = query(".button-container")[0];
        domStyle.set(s.children[2], "display", allValid ? "inline-block" : "none");
        domStyle.set(s.children[3], "display", allValid ? "none" : "inline-block");
      },

      _moveRow: function (up, row) {
        var v = this._selectedLayerIds[row.rowIndex];
        var i = up ? row.rowIndex + 1 : row.rowIndex - 1;
        var _v = this._selectedLayerIds[i];
        this._selectedLayerIds.splice(up ? row.rowIndex : i, 2, up ? _v : v, up ? v : _v);
      },

      _getLayerList: function () {
        var layersIds;
        if (this._selectedLayerIds.length < this._allLayers.length) {
          layersIds = array.filter(this._allLayers, lang.hitch(this, function (layer) {
            return this._selectedLayerIds.indexOf(layer.id) < 0;
          }));
        }
        else {
          layersIds = this._allLayers;
        }
        return layersIds;
      },

      _addTabRow: function() {
        var result = this.tabTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          var layerList = this._getLayerList();
          this._addTabLayers(tr, layerList[0]);
          this._addTabTypes(tr);
          this._addTabLabel(tr);
        }
      },

      _addTabLayers: function(tr, layerInfo) {
        var lyrOptions = lang.clone(this.layer_options);
        var td = query('.simple-table-cell', tr)[0];
        if (td) {
          var layerChooserFromMap = new FeatureLayerChooserFromMap({
            multiple: false,
            showLayerFromFeatureSet: false,
            showTable: false,
            onlyShowVisible: false,
            createMapResponse: this.map.webMapResponse
          });
          layerChooserFromMap.startup();

          var tabLayers = new LayerChooserFromMapWithDropbox({
            layerChooser: layerChooserFromMap,
            options: lyrOptions,
            isValid: this.validateLayer,
            required: true,
            invalidValues: [],
            row: tr
          });

          tabLayers.placeAt(td);
          tabLayers.startup();
          tr.selectLayers = tabLayers;
          tabLayers._missingMsg = this.nls.layer_error;

          this.own(on(tabLayers, 'selection-change', function (layer) {
            this.emit('used-layer-change', { layer: layer[0], rowIndex: this.row.rowIndex});

            var p = this.domNode.parentNode;
            //validate types
            if (p.parentNode.selectTypes) {
              p.parentNode.selectTypes.validate();
              focusUtil.focus(p.parentNode.selectTypes.domNode);
              p.parentNode.selectTypes.domNode.blur();
            }
            //focus on table node
            var table = query(".jimu-simple-table")[0];
            focusUtil.focus(table);
            focusUtil.focus(this.domNode);
          }));

          this.own(on(tabLayers, 'used-layer-change', lang.hitch(this, function (changedData) {
            this._selectedLayerIds[changedData.rowIndex] = changedData.layer.id;
          })));

          if (layerInfo) {
            layerInfo.getLayerObject().then(lang.hitch(this, function (layer) {
              tr.selectLayers.setSelectedLayer(layer);
            }));
          }

          focusUtil.focus(tabLayers.domNode);
          tabLayers.domNode.blur();
          var table = query(".jimu-simple-table")[0];
          focusUtil.focus(table);
        }
      },

      _addTabTypes: function(tr) {
        var typeOptions = lang.clone(this.analysis_options);
        var td = query('.simple-table-cell', tr)[1];
        if (td) {
          var tabTypes = new Select({
            style: {
              width: "100%",
              height: "26px"
            },
            required: true,
            isValid: this.validateType,
            validFields: this.validFields,
            options: typeOptions,
            row: tr,
            parent: this,
            parentTable: this.tabTable,
            nls: this.nls,
            'class': 'shortTypeSelect'
          });
          tabTypes.placeAt(td);
          tabTypes.startup();
          tabTypes._missingMsg = this.nls.need_group_field;
          tabTypes.on("change", function () {
            if (this.row.type !== this.value && this.row.tabInfo) {
              delete this.row.tabInfo.advStat;
            }
            this.domNode.blur();
            var table = query(".jimu-simple-table")[0];
            this.row.type = this.value;
            focusUtil.focus(table);
          });
          tr.selectTypes = tabTypes;
          focusUtil.focus(tabTypes.domNode);
          tabTypes.domNode.blur();
          var table = query(".jimu-simple-table")[0];
          focusUtil.focus(table);
        }
      },

      layerExists: function (options, layerOption) {
        //test if layer is no longer found in webmap
        var v = layerOption.layers;
        var isValid = false;
        array.forEach(options, function (opt) {
          if (!isValid) {
            isValid = opt.value === v;
          }
        });
        return isValid;
      },

      validateLayer: function () {
        var isValid = this.invalidValues.indexOf(this.value) === -1;
        var editIcon = this.row.querySelectorAll('.jimu-icon-edit')[0];
        if (!isValid) {
          domClass.add(editIcon, 'jimu-state-disabled');
        } else {
          if (domClass.contains(editIcon, 'jimu-state-disabled')) {
            domClass.remove(editIcon, 'jimu-state-disabled');
          }
        }
        if (this.row.selectTypes) {
          this.row.selectTypes.disabled = !isValid;
        }
        return isValid;
      },

      validateType: function () {
        //This is the validFields object we get
        //{
        //  layer: this.callerLayer,
        //  hasPopupFields: temp_fields.length > 0,
        //  hasFields: this.fields.length > 0,
        //  hasSummaryPopupFields: validPopupFields,
        //  hasSummaryFields: validFields
        //}
        var row = this.row;
        var analysisType = this.value;
        var isValid = true;
        var isEditable = true;
        var tabInfo = row.tabInfo;
        var hasStats = true;
        var stats;
        if (tabInfo && row && row.type && tabInfo.type !== row.type && tabInfo.type !== 'groupedSummary') {
          tabInfo = undefined;
        }
        if (tabInfo && tabInfo.advStat && tabInfo.advStat.stats) {
          //user defined values
          stats = tabInfo.advStat.stats;
        } else {
          hasStats = false;
        }
        for (var i = 0; i < this.validFields.length; i++) {
          var vf = this.validFields[i];
          var item = row.selectLayers.getSelectedItem();
          if (item) {
            if (vf.layer === item.layerInfo.id) {
              row.validFields = vf;

              //if no stats and no tabinfo it's the inital load
              //all is good if it has appropriate popupfields as they will be selected automatically
              //otherwise we need the user to define
              //the exception is grouped as it will not do any auto select of fields

              if (analysisType === 'summary') {
                if (stats) {
                  if (!stats.hasOwnProperty('min') && !stats.hasOwnProperty('max') &&
                    !stats.hasOwnProperty('avg') && !stats.hasOwnProperty('sum') &&
                    !stats.hasOwnProperty('count') && !stats.hasOwnProperty('area') &&
                    !stats.hasOwnProperty('length')) {
                    hasStats = false;
                  }
                }
                if (!hasStats) {
                  if (typeof (tabInfo) === 'undefined' && !vf.hasSummaryPopupFields) {
                    //if no numeric popup fields but it does have other numeric fields
                    this._missingMsg = vf.hasSummaryFields ? this.nls.no_valid_popup_fields : this.nls.no_valid_fields;
                    isValid = false;
                  } else if (tabInfo) {
                    this._missingMsg = !vf.hasSummaryPopupFields ? this.nls.no_valid_popup_fields :
                      this.nls.no_valid_fields;
                    isValid = false;
                  }
                }
              } else if (analysisType === 'groupedSummary') {
                this._missingMsg = this.nls.need_group_field;
                if (stats && !stats.hasOwnProperty('pre') && !stats.hasOwnProperty('suf') || !hasStats) {
                  isValid = false;
                }
              } else {
                //proximity or closest
                hasStats = (stats && stats.outFields) ? stats.outFields.length > 0 : false;
                if (!hasStats && typeof (tabInfo) === 'undefined' && !vf.hasPopupFields) {
                  this._missingMsg = this.nls.no_valid_popup_fields;
                  isValid = false;
                } else if (!hasStats && !vf.hasPopupFields) {
                  this._missingMsg = !vf.hasPopupFields ? this.nls.no_valid_popup_fields : this.nls.no_valid_fields;
                  isValid = false;
                }
              }
              break;
            }
          }
        }
        row.isValid = isValid;
        row.isEditable = isEditable;

        var editIcon = row.querySelectorAll('.jimu-icon-edit')[0];
        if (!isEditable) {
          domClass.add(editIcon, 'jimu-state-disabled');
        } else {
          if (domClass.contains(editIcon, 'jimu-state-disabled')) {
            domClass.remove(editIcon, 'jimu-state-disabled');
          }
        }

        //check all rows
        var rows = this.parentTable.getRows();
        var allValid = true;
        for (var ii = 0; ii < rows.length; ii++) {
          if (!rows[ii].isValid) {
            allValid = false;
            break;
          }
        }
        var p = this.parent;
        var s = query(".button-container")[0];
        domStyle.set(s.children[2], "display", allValid && p.saveValid && p.textValid ? "inline-block" : "none");
        domStyle.set(s.children[3], "display", allValid && p.saveValid && p.textValid ? "none" : "inline-block");

        return isValid;
      },

      checkSmallString: function (d, v) {
        return this.checkString(d, v, 180);
      },

      checkLargeString: function (d, v) {
        return this.checkString(d, v, 260);
      },

      checkString: function (d, v, size) {
        var visSpan = domConstruct.create("div", {
          "class": "visDivLength",
          "id": "SA_VisDiv",
          "innerHTML": v
        }, d.domNode);

        var fitsWidth = visSpan.clientWidth < size ? true : false;

        domConstruct.destroy(visSpan);

        this.textValid = fitsWidth;
        var id = registry.byNode(d.domNode).id;
        query('.validationBox2').forEach(lang.hitch(this, function (node) {
          var _dijit = registry.byNode(node);
          if (id !== _dijit.id) {
            this.textValid = this.textValid ? _dijit.state !== 'Error' : this.textValid;
          }
        }));

        if (this.textValid && this.saveValid && this._validateRows()) {
          this._enableOk();
        } else {
          this._disableOk();
        }

        return fitsWidth;
      },

      _addTabLabel: function(tr) {
        var td = query('.simple-table-cell', tr)[2];
        var labelTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "26px"
          }
        });
        labelTextBox.placeAt(td);
        labelTextBox.startup();
        tr.labelText = labelTextBox;
      },

      _onEditLayerClicked: function(tr) {
        this.curRow = tr;
        if (tr.isEditable) {
          var selectedItem = tr.selectLayers.getSelectedItem();
          var aTab = tr.tabInfo;
          if (!aTab) {
            aTab = {};
            aTab.label = tr.labelText.value;
            aTab.type = tr.selectTypes.value;
            aTab.layers = selectedItem.layerInfo.id;
            aTab.advStat = {};
            tr.tabInfo = aTab;
          }
          var id = typeof (aTab.layerTitle) !== 'undefined' ? aTab.layers : this.getLayerID(aTab.layers);
          if (aTab.type !== tr.selectTypes.value || id !== selectedItem.layerInfo.id) {
            aTab.type = tr.selectTypes.value;
            aTab.layers = selectedItem.layerInfo.id;
            aTab.advStat = {};
          }

          var args = {
            nls: this.nls,
            callerLayer: selectedItem.layerInfo.id,
            callerTab: aTab,
            callerOpLayers: this.opLayers._layerInfos,
            map: this.map
          };

          var sourceDijit = new FieldPicker(args);

          var popup = new Popup({
            width: 830,
            height: 560,
            content: sourceDijit,
            titleLabel: this.nls.selectFields + ": " + selectedItem.layerInfo.title
          });

          this.own(on(sourceDijit, 'ok', lang.hitch(this, function (items) {
            this.curRow.tabInfo.advStat = items;
            var n = this.curRow.selectTypes.domNode;
            this.curRow.selectTypes.validate();
            focusUtil.focus(n);
            focusUtil.focus(n.parentNode.offsetParent);
            this.curRow = null;
            //this.summaryFields.push(items);
            sourceDijit.destroy();
            sourceDijit = null;
            popup.close();
          })));

          this.own(on(sourceDijit, 'cancel', lang.hitch(this, function () {
            this.curRow = null;
            sourceDijit.destroy();
            sourceDijit = null;
            popup.close();
          })));
        }
      },

      _disableOk: function () {
        var s = query(".button-container")[0];
        domStyle.set(s.children[2], "display", "none");
        domStyle.set(s.children[3], "display", "inline-block");
      },

      _enableOk: function () {
        var s = query(".button-container")[0];
        domStyle.set(s.children[2], "display", "inline-block");
        domStyle.set(s.children[3], "display", "none");
      },

      //report
      getLogo: function () {
        // return imageData if available else return default image path
        if (this.logoChooser && this.logoChooser.imageData) {
          return this.logoChooser.getImageData();
        } else if (this.reportSettings && this.reportSettings.logo) {
          return this.reportSettings.logo;
        } else {
          return "${appPath}/widgets/SituationAwareness/images/defaultLogo.png";
        }
      },

      _createLogoPreview: function () {
        var baseURL, imageInfo, imageSrc;
        //by default
        imageSrc = this.folderUrl + "/images/defaultLogo.png";
        //logo is configured use it else show default logo
        if (this.reportSettings && this.reportSettings.logo) {
          imageInfo = this.reportSettings.logo;
          //if "${appPath}" string found in imageInfo
          if (imageInfo.indexOf("${appPath}") > -1) {
            baseURL = this.folderUrl.slice(0, this.folderUrl.lastIndexOf("widgets"));
            imageSrc = string.substitute(imageInfo, { appPath: baseURL });
          } else {
            imageSrc = imageInfo;
          }
        }
        domAttr.set(this.imageChooserPreview, 'src', imageSrc);
      },

      _initImageChooser: function () {
        this.logoChooser = new ImageChooser({
          cropImage: false,
          showSelfImg: false,
          goldenWidth: 50,
          goldenHeight: 50,
          displayImg: this.imageChooserPreview,
          format: [ImageChooser.GIF, ImageChooser.PNG, ImageChooser.JPEG]
        });
        // Placing image chooser
        this.logoChooser.placeAt(this.logoChooserNode);
        this._createLogoPreview();
        domClass.add(this.logoChooser.domNode, "imageChooserContent");
      },

      getFootnoteForReport: function () {
        return this.footnoteTextArea.value ? this.footnoteTextArea.value : "";
      },

      getPrintReportGPServiceURL: function () {
        return this._printTaskURL ? this._printTaskURL : "";
      },

      _attachPrintReportGPSourceEvents: function (gpSource, popup) {
        this.own(on(gpSource, "ok", lang.hitch(this, function (tasks) {
          if (tasks && tasks.length > 0 && tasks[0].url) {
            this.printGPServiceTextBox.set("value", tasks[0].url);
            this._printTaskURL = tasks[0].url;
          } else {
            this.printGPServiceTextBox.set("value", "");
            this._printTaskURL = "";
          }
          popup.close();
        })));
        this.own(on(gpSource, "cancel", lang.hitch(this, function () {
          popup.close();
        })));
      },

      _onSetButtonClick: function (gpSource) {
        var popup;
        popup = new Popup({
          "titleLabel": this.nls.downloadTab.printGPServiceLabel,
          "width": 830,
          "height": 560,
          "content": gpSource
        });
        return popup;
      }
    });
  });
