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
  './LocatorSourceSetting',
  './StoreGeocodeResults'
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
    LocatorSourceSetting,
    StoreGeocodeResults) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-setting-critical-facilities',

      //TODO persist values and reload correctly
      //TODO disable OK when no layer is selected
      //TODO add logic for needing at least one of the checkboxes checked...ok should disable
      //TODO figure out what's up with the css for all SimpleTable instances with the rows. I handled in some way for IS but it was not correct
      //TODO update validation logic for the validation controls for max and search dist
      //TODO disable ok if any validators are invalid
      //TODO need to persist group/server storage stuff
      //TODO update set server 'Set' button logic

      //TODO edit layer isRecognized names do not exist if the edit fields dialog is not opened
      // need to handle defaults

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
        this._initTabs();
        this._createLayerChooserSelect(true);
        this._initLocationOptions();
      },

      _initTabs: function () {
        this._tabsContainer = new TabContainer3({
          tabs: [{
            title: this.nls.layerTab.layerTabLabel,
            content: this.layerTabNode
          }, {
            title: this.nls.geocodeTab.geocodeTabLabel,
            content: this.geocodeTabNode
          }]
        }, this.tabContainer);
        this.own(on(this._tabsContainer, "tabChanged", lang.hitch(this, function () {
          this._tabsContainer.containerNode.scrollTop = 0;
        })));
        this._tabsContainer.startup();
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

        //XY is managed here...multi and single and managed per locator
        //this.enableXYField = this._initCheckBox(this.enableXYField, this.nls.enableXYField, this.editXYFields);

        this.xyEnabled = true;
        this.own(on(this.editXYFields, 'click', lang.hitch(this, this._onXYEditFieldsClick)));

        this.own(on(this.editLayerFields, 'click', lang.hitch(this, this._onLayerEditFieldsClick)));

        //Store share results options
        this.enableStoreResults = this._initStoreResultsCheckBox(this.enableStoreResults, this.nls.enableStoreResults, this.storeResultsOptions);

        this._initShareSelect();
        this._initStoreUrl(this.storeUrl);

        this.rdoOrg = this._initStoreRdo(this.rdoOrg, [this.shareSelect, this.orgTip], "org");
        this.rdoServer = this._initStoreRdo(this.rdoServer, [this.storeUrl, this.setServer, this.serverTip], "server");
      },

      _initMaxRecords: function () {
        var ls = this.config.layerSettings;
        this.maxRecords.setValue((ls && ls.maxRecords && ls.maxRecords !== NaN) ? ls.maxRecords : undefined);
      },

      _initSearchRadius: function () {
        var ls = this.config.layerSettings;

        //set distance
        this.searchDistance.setValue((ls && ls.distance && ls.distance !== NaN) ? ls.distance : 2);

        //set units    
        var validUnits = ['miles', 'kilometers', 'feet', 'meters', 'yards'];
        var defaultUnit = (ls && ls.unit && validUnits.indexOf(ls.unit) > -1) ? ls.unit : 'feet';
        var unitOptions = [];
        array.forEach(validUnits, function (k) {
          unitOptions.push({
            label: window.jimuNls.units[k],
            value: k,
            selected: k === defaultUnit ? true : false
          });
        });
        this.searchUnit.addOption(unitOptions);
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

      _initStoreUrl: function (node) {
        node.selectControl = new ValidationTextBox({
          required: true,
          trim: true,
          disabled: true,
          style: "width: 100%;",
          placeHolder: this.nls.eg + " " + this.nls.inServerExample
        });
        node.selectControl.placeAt(node).startup();
      },

      _initShareSelect: function () {
        this._getGroupValues().then(lang.hitch(this, function (vals) {
          this.hasGroups = vals.length > 0 ? true : false;
          this.addSelect(this.shareSelect, vals);
        }));
      },

      _getGroupValues: function () {
        var def = new Deferred();
        var portal = portalUtils.getPortal(this.appConfig.portalUrl);
        portal.getUser().then(lang.hitch(this, function (user) {
          var values = [];
          for (var k in user.groups) {
            var g = user.groups[k];
            values.push({
              label: g.title,
              value: g.id
            });
          }
          def.resolve(values);
        }), lang.hitch(this, function (err) {
          console.log(err);
          def.resolve([]);
        }));
        return def;
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

      _initStoreRdo: function (domNode, nodes, type) {
        domNode = new RadioButton({
          _rdoType: type
        }, domNode);
        array.forEach(nodes, lang.hitch(this, function (node) {
          this._toggleNode(node, false, 'display-none', 'display-block');
        }));       
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          var enabled = domNode.checked;
          if (domNode._rdoType === "org") {
            this.useOrg = enabled;
            this.useServer = !this.useOrg;
          } else {
            this.useServer = enabled;
            this.useOrg = !this.useServer;
          }
          array.forEach(nodes, lang.hitch(this, function (node) {
            this._toggleNode(node, enabled, 'display-none', 'display-block');
          }));
        })));
        return domNode;
      },

      _initStoreResultsCheckBox: function (domNode, nlsValue, editNode) {
        domNode = new CheckBox({
          checked: false,
          label: nlsValue
        }, domNode);
        this._toggleNode(editNode, false, 'display-none', 'display-block');
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          this.storeResults = domNode.getValue();
          this._toggleNode(editNode, this.storeResults, 'display-none', 'display-block');
        })));
        return domNode;
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
        this._initSearchRadius();

        //Location settings

        //X/Y settings
        if (!this.config.defaultXYFields) {
          this._setDefaultXYFields();
        }

        if (typeof (this.config.xyEnabled) !== 'undefined') {
          this.xyEnabled = this.config.xyEnabled;
          //this.enableXYField.setValue(this.config.xyEnabled);
        }

        this._setXYFields(this.defaultXYFields, this.config);

        //Store results settings
        this.storeResults = this.config.storeResults || false;
        this.enableStoreResults.setValue(this.storeResults); 
        this._toggleNode(this.storeResultsOptions, this.storeResults, 'display-none', 'display-block');

        //if set in config use that otherwise set default to use org
        this.useOrg = (this.config.useOrg || this.config.useServer) ? this.config.useOrg : true;
        this.rdoOrg.set("checked", this.useOrg);

        this.useServer = (this.config.useOrg || this.config.useServer) ? this.config.useServer : false;
        this.rdoServer.set("checked", this.useServer);

        if (this.config.shareGroup) {
          this.shareSelect.selectControl.set('value', this.config.shareGroup);
        }
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
          symbol: this.symbolPicker.getSymbol().toJson(),
          maxRecords: this.maxRecords.getValue(),
          distance: this.searchDistance.getValue(),
          unit: this.searchUnit.getValue()
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

        this.config.useOrg = this.useOrg;
        this.config.useServer = this.useServer;
        this.config.storeResults = this.storeResults;

        this.config.shareGroup = this.shareSelect.selectControl.value;

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

      _storeOptionsChanged: function () {
        console.log(this);
      },

      _onSetServerClick: function () {
        this.storeGeocodeResults = new StoreGeocodeResults({
          url: this.storeUrl.selectControl.get('value') || "",
          nls: this.nls
        });
        this.shelter = new LoadingShelter({
          hidden: true
        });

        this.storePopup = new Popup({
          autoHeight: true,
          content: this.storeGeocodeResults.domNode,
          container: window.jimuConfig.layoutId,
          width: 640,
          buttons: [{
            label: this.nls.ok,
            onClick: lang.hitch(this, function () {
              this.storePopup.close();
              this.emit('geocode-results-popup-ok');
              this._onSelectLocatorUrlOk()
            })
          }, {
            label: this.nls.cancel,
            classNames: ['jimu-btn-vacation'],
            onClick: lang.hitch(this, function () {
              this.storePopup.close();
              this.emit('geocode-results-popup-cancel');
            })
          }],
          onClose: lang.hitch(this, function () {
            this.emit('geocode-results-popup-close');
          })
        });
        this.shelter.placeAt(this.storePopup.domNode);
        html.setStyle(this.storeGeocodeResults.domNode, 'width', '580px');//TODO
        //html.addClass(
        //  this.storeGeocodeResults.domNode,
        //  'override-geocode-service-chooser-content'
        //);

        this.storeGeocodeResults.own(
          on(this.storeGeocodeResults, 'validate-click', lang.hitch(this, function () {
            //html.removeClass(
            //  this.storeGeocodeResults.domNode,
            //  'override-geocode-service-chooser-content'
            //);
          }))
        );
      },

      _onSelectLocatorUrlOk: function (evt) {
        if (!(evt && evt[0] && evt[0].url && this.domNode)) {
          return;
        }
        this.shelter.show();
        var url = evt[0].url;
        esriRequest({
          url: url,
          content: {
            f: 'json'
          },
          handleAs: 'json',
          callbackParamName: 'callback'
        }).then(lang.hitch(this, function (response) {
          this.shelter.hide();
          if (response) {
            this.storeUrl.selectControl.set('value', url);
          } else {
            new Message({
              'message': this.nls.eg
            });
          }
        }), lang.hitch(this, function (err) {
          console.error(err);
          this.shelter.hide();
          new Message({
            'message': esriLang.substitute({
              'URL': this._getRequestUrl(url)
            }, lang.clone(this.nls.eg))
          });
        }));
      },

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
