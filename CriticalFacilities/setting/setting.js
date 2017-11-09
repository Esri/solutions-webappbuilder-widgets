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
  'dojo/_base/html',
  'dojo/on',
  'dojo/when',
  'dojo/query',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/Deferred',
  'dijit/_WidgetsInTemplateMixin',
  'dijit/form/NumberSpinner',
  'dijit/form/Select',
  'dijit/form/ValidationTextBox',
  'dijit/form/RadioButton',
  'jimu/BaseWidgetSetting',
  'jimu/dijit/SimpleTable',
  'jimu/dijit/TabContainer3',
  'jimu/LayerInfos/LayerInfos',
  'jimu/utils',
  'jimu/portalUtils',
  'jimu/dijit/Message',
  'jimu/dijit/SymbolPicker',
  'jimu/dijit/CheckBox',
  'jimu/dijit/LayerChooserFromMapWithDropbox',
  "jimu/dijit/Popup",
  "jimu/dijit/LoadingShelter",
  'esri/symbols/jsonUtils',
  "esri/request",
  "esri/lang",
  '../locatorUtils',
  './EditablePointFeatureLayerChooserFromMap',
  './EditFields',
  './LocatorSourceSetting'
],
  function (
    declare,
    lang,
    html,
    on,
    when,
    query,
    array,
    domConstruct,
    domStyle,
    Deferred,
    _WidgetsInTemplateMixin,
    NumberSpinner,
    Select,
    ValidationTextBox,
    RadioButton,
    BaseWidgetSetting,
    SimpleTable,
    TabContainer3,
    LayerInfos,
    utils,
    portalUtils,
    Message,
    SymbolPicker,
    CheckBox,
    LayerChooserFromMapSelect,
    Popup,
    LoadingShelter,
    jsonUtils,
    esriRequest,
    esriLang,
    _utils,
    EditablePointFeatureLayerChooserFromMap,
    EditFields,
    LocatorSourceSetting) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-setting-critical-facilities',

      //TODO persist values and reload correctly
      //TODO disable OK when no layer is selected
      //TODO add logic for needing at least one of the checkboxes checked...ok should disable
      //TODO figure out what's up with the css for all SimpleTable instances with the rows. I handled in some way for IS but it was not correct
      //TODO update validation logic for the validation controls for max and search dist
      //TODO disable ok if any validators are invalid

      //Questions
      //TODO should we support an option for configure user to mark certain fields as required or optional?
      
      operLayerInfos: null,
      jimuLayerInfo: null,
      jimuLayerObject: null,
      layerInfo: null,

      postMixInProperties: function () {
        this.inherited(arguments);
        this.nls = lang.mixin(this.nls, window.jimuNls.common);
      },

      postCreate: function () {
        this.inherited(arguments);
        if (!(this.config && this.config.sources)) {
          this.config.sources = [];
        }
      },

      startup: function () {
        this.inherited(arguments);
        LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (infos) {
          this.operLayerInfos = infos;
          this._initUI();
          _utils.setMap(this.map);
          _utils.setLayerInfosObj(this.operLayerInfos);
          _utils.setAppConfig(this.appConfig);
          _utils.setDefaultXYFields(this.config.defaultXYFields);
          when(_utils.getConfigInfo(this.config)).then(lang.hitch(this, function (config) {
            if (!this.domNode) {
              return;
            }
            this.setConfig(config);
          }));
        }));
      },

      _initUI: function () {
        this._createLayerChooserSelect(true);
        this._initLocationOptions();
      },

      _createLayerChooserSelect: function (bindEvent) {
        if (this.layerChooserSelect) {
          this.layerChooserSelect.destroy();
        }
        this.layerChooserSelect = null;

        var layerChooserFromMap = new EditablePointFeatureLayerChooserFromMap({
          multiple: false,
          showLayerFromFeatureSet: false,
          showTable: false,
          onlyShowVisible: false,
          createMapResponse: this.map.webMapResponse
        });
        layerChooserFromMap.startup();

        this.layerChooserSelect = new LayerChooserFromMapSelect({
          layerChooser: layerChooserFromMap
        });
        this.layerChooserSelect.placeAt(this.layerTd);
        this.layerChooserSelect.startup();
        if (bindEvent) {
          this.own(on(this.layerChooserSelect, 'selection-change', lang.hitch(this, this._onLayerChanged)));
        }
      },

      _initLocationOptions: function () {
        this.sourceList = new SimpleTable({
          autoHeight: false,
          selectable: true,
          fields: [{
            name: "name",
            title: this.nls.name,
            width: "auto",
            type: "text",
            editable: false
          }, {
            name: "actions",
            title: "",
            width: "80px",
            type: "actions",
            actions: ["up", "down", "delete"]
          }]
        }, this.sourceList);
        html.setStyle(this.sourceList.domNode, 'height', '100%');
        this.sourceList.startup();
        this.own(on(this.sourceList, 'row-select', lang.hitch(this, this._onSourceItemSelected)));
        this.own(on(this.sourceList, 'row-delete', lang.hitch(this, this._onSourceItemRemoved)));

        this.xyEnabled = true;
        this.own(on(this.editXYFields, 'click', lang.hitch(this, this._onXYEditFieldsClick)));

        this.own(on(this.editLayerFields, 'click', lang.hitch(this, this._onLayerEditFieldsClick)));
      },

      _initMaxRecords: function () {
        var ls = this.config.layerSettings;
        //this.maxRecords.setValue((ls && ls.maxRecords && ls.maxRecords !== NaN) ? ls.maxRecords : undefined);
      },

      _initSymbolPicker: function () {
        
        if (this.config.layerSettings && this.config.layerSettings.symbol) {
          //TODO any way to check this is a valid symbol?
          this.symbolPicker.showBySymbol(jsonUtils.fromJson(this.config.layerSettings.symbol));

          //this is from filter...loook at how they persist image..I know there was a change around this area for the next release
          //if (config.icon) {
          //  this.imageChooser.setDefaultSelfSrc(jimuUtils.processUrlInWidgetConfig(config.icon, this.folderUrl));
          //} else {
          //  this._setDefaultTaskIcon();
          //}
        } else {
          this.symbolPicker.showByType('marker');
        }
      },

      _onLayerChanged: function () {
        var item = this.layerChooserSelect.getSelectedItem();
        if (!item) {
          return;
        }
        this.jimuLayerInfo = item.layerInfo;
        this.jimuLayerObject = item.layerInfo.layerObject;

        var defaultLayerInfo = this._getDefaultLayerInfo(this.jimuLayerObject);
        var configLayerInfo = this._getLayerInfoFromConfiguration(this.jimuLayerObject);

        this.layerInfo = configLayerInfo || defaultLayerInfo;
      },

      addSelect: function (node, values) {
        node.selectControl = new Select({
          options: values,
          style: "width: 100%;"
        });
        node.selectControl.placeAt(node).startup();
      },

      _getLayerDefinitionForFilterDijit: function (layer) {
        var layerDefinition = null;

        if (layer.declaredClass === 'esri.layers.FeatureLayer') {
          layerDefinition = jimuUtils.getFeatureLayerDefinition(layer);
        }

        if (!layerDefinition) {
          layerDefinition = {
            currentVersion: layer.currentVersion,
            fields: lang.clone(layer.fields)
          };
        }

        return layerDefinition;
      },

      _initCheckBox: function (domNode, nlsValue, editNode) {
        domNode = new CheckBox({
          checked: false,
          label: nlsValue
        }, domNode);
        this._toggleNode(editNode, false, 'edit-fields-disabled', 'edit-fields');
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          var enabled = domNode.getValue();
          this.xyEnabled = enabled;
          this._toggleNode(editNode, enabled, 'edit-fields-disabled', 'edit-fields');
        })));
        return domNode;
      },

      _toggleNode: function (domNode, enable, disableClass, enableClass) {
        if (domNode) {
          html.removeClass(domNode, enable ? disableClass : enableClass);
          html.addClass(domNode, enable ? enableClass : disableClass);
        }
      },

      _onLayerEditFieldsClick: function (tr) {
        if (this.layerInfo) {
          var editFields = new EditFields({
            nls: this.nls,
            _layerInfo: this.layerInfo,
            type: 'fieldInfos'
          });
          editFields.popupEditPage();
        } else {
          new Message({
            message: this.nls.noSelectField
          });
        }
      },

      setConfig: function (config) {
        this.config = config;
        var sources = config.sources;
        array.forEach(sources, lang.hitch(this, function (source, index) {
          var addResult = this.sourceList.addRow({
            name: source.name || ""
          });
          if (addResult && addResult.success) {
            this._setRowConfig(addResult.tr, source);
            if (index === 0) {
              var firstTr = addResult.tr;
              setTimeout(lang.hitch(this, function () {
                this.sourceList.selectRow(addResult.tr);
                firstTr = null;
              }), 100);
            }
          } else {
            console.error("add row failed ", addResult);
          }
        }));

        //get the config layer if it exists
        var layerInfo;
        var layerSettings = this.config.layerSettings;
        if (layerSettings && layerSettings.layerInfo && layerSettings.layerInfo.featureLayer) {
          layerInfo = this.operLayerInfos.getLayerInfoById(this.config.layerSettings.layerInfo.featureLayer.id);
        }
        //if we have a config layer set it otherwise just expand the chooser
        if (layerInfo) {
          layerInfo.getLayerObject().then(lang.hitch(this, function (layer) {
            this.layerChooserSelect.setSelectedLayer(layer).then(lang.hitch(this, function (success) {
              //TODO If we need to delay the event binding could be done here rather than on load

            }));
          }));
        } else {
          this.layerChooserSelect.showLayerChooser();
        }

        //Layer Settings
        this._initSymbolPicker();
        this._initMaxRecords();

        //Location settings

        //X/Y settings
        if (!this.config.defaultXYFields) {
          this._setDefaultXYFields();
        }

        if (typeof (this.config.xyEnabled) !== 'undefined') {
          this.xyEnabled = this.config.xyEnabled;
        }

        this._setXYFields(this.defaultXYFields, this.config);
      },

      _getLayerInfoFromConfiguration: function (layer) {
        var layerInfo = null;
        var layerSettings = this.config.layerSettings;
        if (layerSettings && layerSettings.layerInfo && layerSettings.layerInfo.featureLayer) {
          if (layerSettings.layerInfo.featureLayer.id === layer.id) {
            layerInfo = layerSettings.layerInfo;
            //TODO??
            layerInfo.fieldInfos = this._getFieldInfos(layer, layerInfo);
          }
        }
        return layerInfo;
      },

      _getDefaultLayerInfo: function (layerObject) {
        var layerInfo = {
          'featureLayer': {
            'id': layerObject.id,
            'fields': layerObject.fields,
            'title': layerObject.name,
            'url': layerObject.url
          },
          'fieldInfos': this._getFieldInfos(layerObject)
        };
        return layerInfo;
      },

      _getDefaultFieldInfos: function (layerObject) {
        var fieldInfos = [];
        for (var i = 0; i < layerObject.fields.length; i++) {
          if (layerObject.fields[i].editable &&
            layerObject.fields[i].name !== layerObject.globalIdField &&
            layerObject.fields[i].name !== layerObject.objectIdField) {
            fieldInfos.push({
              fieldName: layerObject.fields[i].name,
              label: layerObject.fields[i].alias || layerObject.fields[i].name,
              isEditable: layerObject.fields[i].editable,
              visible: true,
              type: layerObject.fields[i].type
            });
          }
        }
        return fieldInfos;
      },

      _getWebmapFieldInfos: function (layerObject) {
        var fieldInfos = [];
        var wFieldInfos = this._getFieldInfosFromWebmap(layerObject.id, this.operLayerInfos);
        if (wFieldInfos) {
          array.forEach(wFieldInfos, function (fi) {
            if ((fi.isEditableOnLayer !== undefined && fi.isEditableOnLayer) &&
              fi.fieldName !== layerObject.globalIdField &&
              fi.fieldName !== layerObject.objectIdField) {
              fieldInfos.push({
                fieldName: fi.fieldName,
                label: fi.label,
                isEditable: fi.isEditable,
                visible: fi.visible,
                type: fi.fieldType
              });
            }
          });
          if (fieldInfos.length === 0) {
            fieldInfos = null;
          }
        } else {
          fieldInfos = null;
        }
        return fieldInfos;
      },

      _getFieldInfosFromWebmap: function(layerId, jimuLayerInfos) {
        var fieldInfos = null;
        var jimuLayerInfo = jimuLayerInfos.getLayerInfoByTopLayerId(layerId);
        if(jimuLayerInfo) {
          var popupInfo = jimuLayerInfo.getPopupInfo();
          if(popupInfo && popupInfo.fieldInfos) {
            fieldInfos = lang.clone(popupInfo.fieldInfos);
          }
        }

        if(fieldInfos) {
          array.forEach(fieldInfos, function(fieldInfo) {
            if(fieldInfo.format &&
              fieldInfo.format.dateFormat &&
              fieldInfo.format.dateFormat.toLowerCase() &&
              fieldInfo.format.dateFormat.toLowerCase().indexOf('time') >= 0
              ) {
              fieldInfo.format.time = true;
            }
          });
        }

        return fieldInfos;
      },

      _getFieldInfos: function (layerObject, layerInfo) {
        var fieldInfos = [];
        var wFieldInfos = this._getWebmapFieldInfos(layerObject);
        var bFieldInfos =  wFieldInfos ? wFieldInfos : this._getDefaultFieldInfos(layerObject);
        if (layerInfo && layerInfo.fieldInfos) {
          array.forEach(layerInfo.fieldInfos, function (fi) {
            if (!fi.hasOwnProperty('isRecognizedValues')) {
              var isRecognizedValues = [fi.fieldName];
              if (fi.label && isRecognizedValues.indexOf(fi.label) === -1) {
                isRecognizedValues.push(fi.label);
              }
              fi.isRecognizedValues = isRecognizedValues;
            }

            if (typeof(fi.visible) === 'undefined') {
              if (wFieldInfos) {
                for (var j = 0; j < wFieldInfos.length; j++) {
                  if (fi.fieldName === wFieldInfos[j].fieldName) {
                    fi.visible = wFieldInfos[j].visible || wFieldInfos[j].isEditable;
                  }
                }
              } else {
                fi.visible = true;
              }
            }

            // keep order.
            for (var i = 0; i < bFieldInfos.length; i++) {
              if (fi.fieldName === bFieldInfos[i].fieldName) {
                fieldInfos.push(fi);
                bFieldInfos[i]._exit = true;
                break;
              }
            }
          });
          // add new fieldInfos at end.
          array.forEach(bFieldInfos, function (fi) {
            if (!fi._exit) {
              fieldInfos.push(fi);
            }
          });
        } else {
          fieldInfos = bFieldInfos;
        }
        return fieldInfos;
      },

      getConfig: function () {
        //Layer Settings
        this.config.layerSettings = {
          layerInfo: this.layerInfo,
          symbol: this.symbolPicker.getSymbol().toJson()
          //maxRecords: this.maxRecords.getValue()
        };

        //Location Settings
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }
        var trs = this.sourceList.getRows();
        var sources = [];
        array.forEach(trs, lang.hitch(this, function (tr) {
          var source = this._getRowConfig(tr);
          delete source._definition;
          this._removeRowConfig(tr);
          sources.push(source);
        }));

        this.config.sources = sources;

        // get layerInfos config
        var checkedLayerInfos = [];
        //trs = this._layersTable.getRows();
        //array.forEach(trs, lang.hitch(this, function (tr) {
        //  var layerInfo = this._getRowConfig(tr);
        //  var radio = query('input', tr.firstChild)[0];
        //  if (radio.checked) {
        //    array.forEach(layerInfo.fieldInfos, lang.hitch(this, function (fi) {
        //      var name = fi.fieldName;
        //      for (var i = 0; i < layerInfo.featureLayer.fields.length; i++) {
        //        var f = layerInfo.featureLayer.fields[i];
        //        if (f.name === name) {
        //          fi.type = f.type;
        //          break;
        //        }
        //      }
        //    }));
        //    checkedLayerInfos.push(layerInfo);
        //  }
        //}));
        if (checkedLayerInfos.length === 0) {
          delete this.config.layerInfos;
        } else {
          this.config.layerInfos = checkedLayerInfos;
        }
        this.config.xyFields = this.xyFields || this.config.defaultXYFields;
        this.config.xyEnabled = this.xyEnabled;

        //search radius
        return this.config;
      },

      ///////////////////////////////////////////////////////////
      //XY Fields
      _setDefaultXYFields: function () {
        this.config.defaultXYFields = [{
          "name": this.nls.xyFieldsLabelX,
          "alias": this.nls.xyFieldsLabelX,
          "visible": true,
          "isRecognizedValues": [this.nls.xyFieldsLabelX, this.nls.longitude, this.nls.easting],
          "type": "STRING"
        }, {
          "name": this.nls.xyFieldsLabelY,
          "alias": this.nls.xyFieldsLabelY,
          "visible": true,
          "isRecognizedValues": [this.nls.xyFieldsLabelY, this.nls.latitude, this.nls.northing],
          "type": "STRING"
        }];
      },

      _onXYEditFieldsClick: function () {
        //TODO remove the enabled check if it will always be enabled 
        if (this.xyEnabled) {
          var editFields = new EditFields({
            nls: this.nls,
            type: 'locatorFields',
            addressFields: this.xyFields || this.config.defaultXYFields,
            popupTitle: this.nls.configureXYFields,
            disableDisplayOption: true
          });
          this.own(on(editFields, 'edit-fields-popup-ok', lang.hitch(this, function () {
            this.xyFields = editFields.fieldInfos;
          })));
          editFields.popupEditPage();
        }
      },

      _setXYFields: function (xyFields, config) {
        var useConfig = config && config.xyFields &&
          config.xyFields.hasOwnProperty('length') && config.xyFields.length > 0;
        this.xyFields = useConfig ? config.xyFields : xyFields;
      },
      ///////////////////////////////////////////////////////////

      ///////////////////////////////////////////////////////////
      //Locator settings
      _onAddClick: function (evt) {
        this._createNewLocatorSourceSettingFromMenuItem({}, {});
      },

      _createNewLocatorSourceSettingFromMenuItem: function (setting, definition) {
        var locatorSetting = new LocatorSourceSetting({
          nls: this.nls,
          map: this.map,
          defaultXYFields: this.config.defaultXYFields
        });
        locatorSetting.setDefinition(definition);
        locatorSetting.setConfig({
          url: setting.url || "",
          name: setting.name || "",
          singleLineFieldName: setting.singleLineFieldName || "",
          countryCode: setting.countryCode || "",
          addressFields: setting.addressFields || [],
          singleAddressFields: setting.singleAddressFields || [],
          xyFields: setting.xyFields || [],
          singleEnabled: setting.singleEnabled || false,
          multiEnabled: setting.multiEnabled || false,
          xyEnabled: setting.xyEnabled || false,
          type: "locator"
        });
        locatorSetting._openLocatorChooser();

        locatorSetting.own(
          on(locatorSetting, 'select-locator-url-ok', lang.hitch(this, function (item) {
            var addResult = this.sourceList.addRow({
              name: item.name || "New Geocoder"
            }, this.sourceList.getRows().length);
            if (addResult && addResult.success) {
              if (this._currentSourceSetting) {
                this._closeSourceSetting();
              }
              locatorSetting.setRelatedTr(addResult.tr);
              locatorSetting.placeAt(this.sourceSettingNode);
              this.sourceList.selectRow(addResult.tr);
              this._currentSourceSetting = locatorSetting;
            }
            var xy = query('.xy-table-no-locator');
            if (xy.length > 0) {
              html.removeClass(xy[0], 'xy-table-no-locator');
              html.addClass(xy[0], 'xy-table');
            }
          }))
        );
        locatorSetting.own(
          on(locatorSetting, 'reselect-locator-url-ok', lang.hitch(this, function (item) {
            var tr = this._currentSourceSetting.getRelatedTr();
            this.sourceList.editRow(tr, {
              name: item.name
            });
          }))
        );
        locatorSetting.own(
          on(locatorSetting, 'select-locator-url-cancel', lang.hitch(this, function () {
            if (this._currentSourceSetting !== locatorSetting) {// locator doesn't display in UI
              locatorSetting.destroy();
              locatorSetting = null;
            }
          }))
        );
      },

      _createNewLocatorSourceSettingFromSourceList: function (setting, definition, relatedTr) {
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }

        this._currentSourceSetting = new LocatorSourceSetting({
          nls: this.nls,
          map: this.map,
          defaultXYFields: this.config.defaultXYFields
        });
        this._currentSourceSetting.setDefinition(definition);
        this._currentSourceSetting.setConfig({
          url: setting.url || "",
          name: setting.name || "",
          singleLineFieldName: setting.singleLineFieldName || "",
          countryCode: setting.countryCode || "",
          addressFields: setting.addressFields,
          singleAddressFields: setting.singleAddressFields,
          xyFields: setting.xyFields,
          singleEnabled: setting.singleEnabled,
          multiEnabled: setting.multiEnabled,
          xyEnabled: setting.xyEnabled,
          type: "locator"
        });
        this._currentSourceSetting.setRelatedTr(relatedTr);
        this._currentSourceSetting.placeAt(this.sourceSettingNode);

        this._currentSourceSetting.own(
          on(this._currentSourceSetting,
            'reselect-locator-url-ok',
            lang.hitch(this, function (item) {
              var tr = this._currentSourceSetting.getRelatedTr();
              this.sourceList.editRow(tr, {
                name: item.name
              });
            }))
        );
      },

      _onSourceItemRemoved: function (tr) {
        if (!this._currentSourceSetting) {
          return;
        }
        var currentTr = this._currentSourceSetting.getRelatedTr();
        if (currentTr === tr) {
          this._currentSourceSetting.destroy();
          this._currentSourceSetting = null;
        }
        var rows = this.sourceList.getRows();
        if (rows.length > 0) {
          this._onSourceItemSelected(rows[0]);
        } else {
          var xy = query('.xy-table');
          if (xy.length > 0) {
            html.removeClass(xy[0], 'xy-table');
            html.addClass(xy[0], 'xy-table-no-locator');
          }
        }
      },

      _onSourceItemSelected: function (tr) {
        var config = this._getRowConfig(tr);
        var currentTr = this._currentSourceSetting && this._currentSourceSetting.tr;
        if (!config || tr === currentTr) {
          return;
        }
        if (this._currentSourceSetting && !this._currentSourceSetting.isValidConfig()) {
          this._currentSourceSetting.showValidationTip();
          this.sourceList.selectRow(currentTr);
          return;
        }
        this._createNewLocatorSourceSettingFromSourceList(config, config._definition || {}, tr);
      },

      _setRowConfig: function (tr, source) {
        query(tr).data('config', lang.clone(source));
      },

      _getRowConfig: function (tr) {
        return query(tr).data('config')[0];
      },

      _removeRowConfig: function (tr) {
        return query(tr).removeData('config');
      },

      _closeSourceSetting: function () {
        var tr = this._currentSourceSetting.getRelatedTr();
        var source = this._currentSourceSetting.getConfig();
        source._definition = this._currentSourceSetting.getDefinition();
        this._setRowConfig(tr, source);
        this.sourceList.editRow(tr, {
          name: source.name
        });
        this._currentSourceSetting.destroy();
      },
      ///////////////////////////////////////////////////////////

      _updateOk: function (disable) {
        var s = query(".button-container")[0];
        var s2 = s.children[2];
        var s3 = s.children[3];
        domStyle.set(s2, "display", disable ? "none" : "inline-block");
        domStyle.set(s3, "display", disable ? "inline-block" : "none");
      },

      destroy: function () {
        this.emit('before-destroy');
        this.inherited(arguments);
      }
    });
  });
