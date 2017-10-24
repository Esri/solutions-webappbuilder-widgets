///////////////////////////////////////////////////////////////////////////
// Copyright 2016 Esri. All Rights Reserved.
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
define(['dojo/_base/declare',
  'jimu/BaseWidget',
  'jimu/LayerInfos/LayerInfos',
  'jimu/dijit/RadioBtn',
  'jimu/PanelManager',
  'jimu/dijit/Message',
  'dojo/_base/lang',
  'dojo/on',
  'dojo/_base/array',
  'dojo/query',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/dom-style',
  'dijit/form/Select',
  'esri/geometry/webMercatorUtils',
  'esri/geometry/Point',
  'esri/Color',
  './js/csvStore'
], function (declare, BaseWidget, LayerInfos, RadioBtn, PanelManager, Message, lang, on, array, query, domConstruct, domClass, domStyle, Select, webMercatorUtils, Point, Color, CsvStore) {
  return declare([BaseWidget], {

    baseClass: 'jimu-widget-critical-facilities',

    fsFields: null,
    myCsvStore: null,
    csvStores: [],
    correctArrayFields: null,
    _fsFields: null,
    _url: null,
    _geocodeSources: null,
    _configLayerInfo: null,
    _useAddr: true,
    _valid: false,
    addrType: "addr",
    xyEnabled: false,
    singleEnabled: false,
    multiEnabled: false,

    //TODO need a way to update map results
    //TODO need a way for the user to process the results prior to submit

    //TODO need to handle geocode errors...for example they choose a field that is not addresses or they have bad address
    //TODO test web mercator points in CSV 

    //TODO add to map needs to be disabled until one of the location mapping options have been chosen

    //TODO when I use a mix of single vs multi between the locators in a list the alias idea is not working correctly
    //...at least on re-config....may just be an issue with the UI updates but need to investigate

    //TOOD also seemd like when I did the simple sinlge line that I stood up tat the feature had the correct location but wrong attributres after the updates to use multi-locators
    // need to investigate further

    postCreate: function () {
      this.inherited(arguments);

      this.own(on(this.map.container, "dragenter", this.onDragEnter));
      this.own(on(this.map.container, "dragover", this.onDragOver));
      this.own(on(this.map.container, "drop", lang.hitch(this, this.onDrop)));

      this.xyEnabled = this.config.xyEnabled;
      
      for (var i = 0; i < this.config.sources.length; i++) {
        var src = this.config.sources[i];
        this.singleEnabled = src.singleEnabled ? true : this.singleEnabled;
        this.multiEnabled = src.multiEnabled ? true : this.multiEnabled;
      }

      this._initLocationUI();
    
      domStyle.set(this.processingNode, 'display', 'none');

      this.panalManager = PanelManager.getInstance();
    },

    startup: function () {
      domStyle.set(this.mainContainer, "display", "none");
      domStyle.set(this.clearMapData, "display", "none");
      domStyle.set(this.submitData, "display", "none");
      domStyle.set(this.updateData, "display", "none");

      if (this.config.layerInfos && this.config.layerInfos.hasOwnProperty(0)) {
        this._valid = true;
        domStyle.set(this.loadWarning, "display", "none");
        this._configLayerInfo = this.config.layerInfos[0];
        this._url = this._configLayerInfo.featureLayer.url;
        this._geocodeSources = this.config.sources;

        this._fsFields = [];
        if (this._configLayerInfo) {
          array.forEach(this._configLayerInfo.fieldInfos, lang.hitch(this, function (field) {
            if (field && field.visible) {
              this._fsFields.push({
                name: field.fieldName,
                value: field.type,
                isRecognizedValues: field.isRecognizedValues
              });
              this.addFieldRow(this.schemaMapTable, field.fieldName, field.label);
            }
          }));

          this._addLocationFieldRows();
        }

        LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (operLayerInfos) {
          this.opLayers = operLayerInfos;
          this.editLayer = operLayerInfos.getLayerInfoById(this._configLayerInfo.featureLayer.id).layerObject;
        }));
      } else {
        domStyle.set(this.schemaMapInstructions, "display", "none");
        domStyle.set(this.loadWarning, "display", "block");
      }
    },

    _initLocationUI: function () {
      var numEnabled = 0;

      //set state of single line address controls
      if (this.singleEnabled) {
        numEnabled += 1;
        this.own(on(this.useAddrNode, 'click', lang.hitch(this, this.onChooseType, 'addr')));
        domStyle.set(this.addressBodyContainer, "display", "block");
      } else {
        domStyle.set(this.addressBodyContainer, "display", "none");
        domStyle.set(this.useAddrNodeContainer, "display", "none");
      }

      //set state of multi line address controls
      if (this.multiEnabled) {
        numEnabled += 1;
        this.own(on(this.useMultiAddrNode, 'click', lang.hitch(this, this.onChooseType, 'multi-addr')));
        domStyle.set(this.addressMultiBodyContainer, "display", !this.singleEnabled ? "block" : "none");
      } else {
        domStyle.set(this.addressMultiBodyContainer, "display", "none");
        domStyle.set(this.useMultiAddrNodeContainer, "display", "none");
      }

      //set state of x/y controls
      if (this.xyEnabled) {
        numEnabled += 1;
        this.own(on(this.useXYNode, 'click', lang.hitch(this, this.onChooseType, 'xy')));
        domStyle.set(this.xyBodyContainer, "display", (!this.singleEnabled && !this.multiEnabled) ? "block" : "none");
      } else {
        domStyle.set(this.xyBodyContainer, "display", "none");
        domStyle.set(this.useXYNodeContainer, "display", "none");
      }

      //if only a single type is enabled adjust the UI..no need to see the radio 
      if (numEnabled === 1) {
        this._useAddr = this.singleEnabled || this.multiEnabled ? true : false;
        this.addrType = this.singleEnabled ? "addr" : this.multiEnabled ? "multi-addr" : "xy";
        domStyle.set(this.singleEnabled ? this.useAddrNodeContainer : this.multiEnabled ? this.useMultiAddrNodeContainer : this.useXYNodeContainer, "display", "none");
        var bodyContainer = this.singleEnabled ? this.addressBodyContainer : this.multiEnabled ? this.addressMultiBodyContainer : this.xyBodyContainer;
        domStyle.set(bodyContainer, window.isRTL ? "padding-right" : "padding-left", "0px");
      }
    },

    _addLocationFieldRows: function () {
      var l = navigator.language.toLowerCase();
      this.singleAddressFields = [];
      this.multiAddressFields = [];
      this.xyFields = [];

      var singleFieldAliases = [];
      var multiFieldAliases = [];
      var xyFieldAliases = [];

      for (var i = 0; i < this._geocodeSources.length; i++) {
        var src = this._geocodeSources[i];
        var name = "";
        var label = "";

        if (src.singleEnabled) {
          var field = src.singleAddressFields[0];
          var rv = (field.recognizedNames && field.recognizedNames.hasOwnProperty(l)) ? field.recognizedNames[l] : [];
          label = field.label || field.alias;
          name = field.fieldName || field.name;
          if (singleFieldAliases.indexOf(label) === -1) {
            singleFieldAliases.push(label);
            this.singleAddressFields.push({
              name: name,
              value: field.type, //TODO ??
              isRecognizedValues: field.isRecognizedValues || rv,
              label: label
            });
            this.addFieldRow(this.addressTable, name, label);
          } else {
            for (var i = 0; i < this.singleAddressFields.length; i++) {
              var f = this.singleAddressFields[i];
              if (f.label === label) {
                f.isRecognizedValues.push.apply(f.isRecognizedValues, field.isRecognizedValues || rv);
                break;
              }
            }
          }
        }
     
        if (src.multiEnabled) {
          array.forEach(src.addressFields, lang.hitch(this, function (field) {
            if (field.visible) {
              label = field.label || field.alias;
              name = field.fieldName || field.name;
              var rv = (field.recognizedNames && field.recognizedNames.hasOwnProperty(l)) ? field.recognizedNames[l] : [];
              if (multiFieldAliases.indexOf(label) === -1) {
                multiFieldAliases.push(label);
                this.multiAddressFields.push({
                  name: name,
                  value: field.type, //TODO ??
                  isRecognizedValues: field.isRecognizedValues || rv,
                  label: label
                });
                this.addFieldRow(this.addressMultiTable, name, label);
              } else {
                for (var i = 0; i < this.multiAddressFields.length; i++) {
                  var f = this.multiAddressFields[i];
                  if (f.label === label) {
                    f.isRecognizedValues.push.apply(f.isRecognizedValues, field.isRecognizedValues || rv);
                    break;
                  }
                }
              }
            }
          }));
        }
      }

      //independant of configured locators
      if (this.xyEnabled) {
        var fieldOne = this.config.xyFields[0].fieldName || this.config.xyFields[0].name;
        var xField = fieldOne === this.nls.xyFieldsLabelX ? this.config.xyFields[0] : this.config.xyFields[1];
        var fieldTwo = this.config.xyFields[1].fieldName || this.config.xyFields[1].name;
        var yField = fieldTwo === this.nls.xyFieldsLabelY ? this.config.xyFields[1] : this.config.xyFields[0];

        this.xyFields.push({
          name: xField.fieldName || xField.name,
          value: xField.type,
          isRecognizedValues: xField.isRecognizedValues
        });

        this.xyFields.push({
          name: yField.fieldName || yField.name,
          value: yField.type,
          isRecognizedValues: yField.isRecognizedValues
        });

        this.addFieldRow(this.xyTable, xField.fieldName || xField.name, xField.label || xField.alias);
        this.addFieldRow(this.xyTable, yField.fieldName || yField.name, yField.label || yField.alias);
      }
    },

    addFieldRow: function (tableNode, keyField, label) {
      var tr = domConstruct.create('tr', {
        'class': 'field-node-tr'
      }, tableNode);

      domConstruct.create('td', {
        'class': 'field-label-node-td',
        innerHTML: label
      }, tr);

      var c = domConstruct.create('td', {
        'class': 'field-control-node-td'
      }, tr);

      var selectFields = new Select({
        'class': "field-select-node",
        'maxheight': "-1" 
      });
      selectFields.placeAt(c);
      selectFields.startup();
      this.own(on(selectFields, 'change', lang.hitch(this, function (v, g) {
        this.validateValues();
      })));
      tr.selectFields = selectFields;
      tr.keyField = keyField;
      tr.label = label;
    },

    validateValues: function(){
      var controlNodes = query('.field-node-tr', this._useAddr ? this.addrType === "addr" ? this.addressTable : this.addressMultiTable : this.xyTable);
      var hasAllVals = true;
      //array.forEach(controlNodes, lang.hitch(this, function (node) {
      //  var selectNode = query('.field-select-node', node)[0];
      //  hasAllVals = hasAllVals && !(selectNode.textContent === this.nls.noValue);
      //}));

      //TODO this x stuff is a temp workaround...not all fields are actually required for multi-field input
      //need to think through this more...would be easy if fields were marked as required/optional
      var x = 0;
      array.forEach(controlNodes, lang.hitch(this, function (node) {
        var selectNode = query('.field-select-node', node)[0];
        var hasVal = !(selectNode.textContent === this.nls.noValue);
        hasAllVals = hasAllVals && hasVal;
        x += hasVal ? 1 : 0;
      }));
      if (x > 1) {
        hasAllVals = true;
      }

      if (hasAllVals) {
        if (domClass.contains(this.addToMap, 'disabled')) {
          domClass.remove(this.addToMap, 'disabled');
        }
      } else {
        if (!domClass.contains(this.addToMap, 'disabled')) {
          domClass.add(this.addToMap, 'disabled');
        }
      }
    },

    onDragEnter: function (event) {
      event.preventDefault();
    },

    onDragOver: function (event) {
      event.preventDefault();
    },

    onDrop: function (event) {
      if (this._valid) {
        if (this.myCsvStore) {
          this.myCsvStore.clear();
        }
        event.preventDefault();

        var dataTransfer = event.dataTransfer,
          files = dataTransfer.files,
          types = dataTransfer.types;

        if (files && files.length > 0) {
          var file = files[0];//single file for the moment
          if (file.name.indexOf(".csv") !== -1) {
            this.myCsvStore = new CsvStore({
              file: file,
              fsFields: this._fsFields,
              map: this.map,
              geocodeSources: this._geocodeSources,
              nls: this.nls,
              appConfig: this.appConfig,
              unMatchedContainer: this.unMatchedContainer
            });
            this.myCsvStore.handleCsv().then(lang.hitch(this, function (obj) {
              this._updateFieldControls(this.schemaMapTable, obj, true, true, obj.fsFields, 'keyField');
              if (this.xyEnabled) {
                this._updateFieldControls(this.xyTable, obj, true, true, this.xyFields, 'keyField');
              }
              if (this.singleEnabled) {
                this._updateFieldControls(this.addressTable, obj, false, true, this.singleAddressFields, 'label');
              }
              if (this.multiEnabled) {
                this._updateFieldControls(this.addressMultiTable, obj, false, true, this.multiAddressFields, 'label');
              }
              this.validateValues();
              domStyle.set(this.schemaMapInstructions, "display", "none");
              domStyle.set(this.mainContainer, "display", "block");
            }));
          }
          this.panalManager.openPanel(this.getPanel());
        }
      }
    },

    onChooseType: function (type) {
      this._useAddr = type === "addr" || type === "multi-addr" ? true : false;
      this.addrType = type;
      this.validateValues();
      domStyle.set(this.addressBodyContainer, "display", type === "addr" ? "block" : "none");
      domStyle.set(this.addressMultiBodyContainer, "display", type === "multi-addr" ? "block" : "none");
      domStyle.set(this.xyBodyContainer, "display", type === "xy" ? "block" : "none");
    },

    _updateFieldControls: function (table, obj, checkFieldTypes, checkArrayFields, arrayFields, type) {

      if (typeof Array.prototype.rxIndexOf === 'undefined') {
        Array.prototype.rxIndexOf = function (rx) {
          for (var i in this) {
            if (this[i].toString().match(rx)) {
              return i;
            }
          }
          return -1;
        };
      }

      var fields = obj.fields;
      var fieldTypes = obj.fieldTypes;
      var controlNodes = query('.field-node-tr', table);
      var noValue = this.nls.noValue;
      var selectMatchField = false;
      
      array.forEach(controlNodes, function (node) {
        var matchFieldName = "";
        var options = node.selectFields.getOptions();
        array.forEach(options, function (option) {
          node.selectFields.removeOption(option);
        });

        node.selectFields.addOption({ label: noValue, value: noValue });

        var ints = ["esriFieldTypeSmallInteger", "esriFieldTypeInteger", "esriFieldTypeSingle"];
        var dbls = ["esriFieldTypeDouble"];
        var t = {};
        var keyFieldType;
        if (checkArrayFields) {
          array.forEach(arrayFields, function (f) {
            t[f.name] = ints.indexOf(f.value) > -1 ? "int" : dbls.indexOf(f.value) > -1 ? "float" : "other";
          });
          keyFieldType = t[node.keyField];
        }

        array.forEach(fields, function (f) {
          var add = false;
          if (fieldTypes[f]) {
            if (checkArrayFields) {
              //Schema Map fields
              add = ((keyFieldType === "int" && fieldTypes[f].supportsInt) ||
                (keyFieldType === "float" && fieldTypes[f].supportsFloat) ||
                (keyFieldType === "other")) ? true : add;
            } else {
              //XY or Address
              if (checkFieldTypes) {
                //XY
                add = fieldTypes[f].supportsFloat || fieldTypes[f].supportsInt ? true : add;
              } else {
                //Address
                add = true;
              }
            }
            if (add) {
              node.selectFields.addOption({ label: f, value: f });
            }
          }
        });

        //Select Matching Field Name if found
        var kf = noValue;
        array_field_loop:
        for (var i = 0; i < arrayFields.length; i++) {
          var af = arrayFields[i];
          var tester = type === 'keyField' ? af.name : af.label;
          if (tester === node[type]) {
            if (typeof (af.isRecognizedValues) !== 'undefined') {
              is_rec_loop:
              for (var ii = 0; ii < af.isRecognizedValues.length; ii++) {
                var idx = fields.rxIndexOf(new RegExp("\\b(" + af.isRecognizedValues[ii] + ")\\b", "i"));//case insensitive
                if (idx > -1) {
                  kf = fields[idx];
                  break array_field_loop;
                }
              }
            }
          }
        }
        node.selectFields.set('value', kf);
      });
    },

    onAddClick: function () {
      if (!domClass.contains(this.addToMap, 'disabled')) {
        domStyle.set(this.addToMap, "display", "none");

        this._setMappedFields(this._fsFields, this.schemaMapTable);
        if (this.addrType === 'addr') {
          this._setFieldsFromNodes(this.singleEnabled ? query('.field-node-tr', this.addressTable) : [], 'single');
        }

        if (this.addrType === 'multi-addr') {
          this._setFieldsFromNodes(this.multiEnabled ? query('.field-node-tr', this.addressMultiTable) : [], 'multi');
        }

        if (this.addrType === 'xy') {
          this._setFieldsFromNodes(this.xyEnabled ? query('.field-node-tr', this.xyTable) : [], 'xy');
        }

        domStyle.set(this.processingNode, 'display', 'block');
        this.myCsvStore.useMultiFields = this.myCsvStore.multiFields && this.myCsvStore.multiFields.length > 0; //TODO this may no longer be necessary if all will be supported
        this.myCsvStore.useAddr = this._useAddr; //TODO this may no longer be necessary if all will be supported
        this.myCsvStore.processForm().then(lang.hitch(this, function () {
          domStyle.set(this.processingNode, 'display', 'none');
          domStyle.set(this.clearMapData, "display", "block");
          domStyle.set(this.submitData, "display", "block");
          domStyle.set(this.updateData, "display", "block");
          this._toggleUnmatched(this.myCsvStore.hasUnmatched);
        }), lang.hitch(this, function (err) {
          domStyle.set(this.processingNode, 'display', 'none');
          domStyle.set(this.addToMap, "display", "block");
        }));
      }
    },

    _toggleUnmatched: function (show) {
      //TODO simplify this and handle bottom-radius
      //make sure anything that is set he is reset when clear occurs

      //this is not being handled correctly yet
      this._toggle(this.unMatchedContainerRow, show ? 'content-hide' : 'content-show', undefined);

      var removeRadiusClass = show ? 'bottom-radius' : undefined;
      var addRadiusClass = !show ? 'bottom-radius' : undefined;
      this._toggle(this.schemaMapContainerRow, removeRadiusClass, addRadiusClass);
      this._toggle(this.schemaMapContainer, removeRadiusClass, addRadiusClass);
    },

    _toggle: function (container, remove, add) {
      if (typeof (remove) !== 'undefined') {
        if (domClass.contains(container, remove)) {
          domClass.remove(container, remove);
        }
      }
      if (typeof (add) !== 'undefined') {
        domClass.add(container, add);
      }
    },

    _setMappedFields: function (fields, table) {
      var mappedFields = {};
      array.forEach(fields, function (setField) {
        if (setField) {
          var fieldName = setField.name;
          var controlNodes = query('.field-node-tr', table); //does this still work correctly with the context chnge
          var mappedField = "";
          for (var i = 0; i < controlNodes.length; i++) {
            var node = controlNodes[i];
            if (node.keyField === fieldName) {
              mappedField = node.selectFields.value;
              break;
            }
          }
          mappedFields[fieldName] = mappedField;
        }
      });
      this.myCsvStore.mappedArrayFields = mappedFields;
    },

    _setFieldsFromNodes: function (controlNodes, type) {
      var single = false;
      var multi = false;
      var fields = [];
      array.forEach(controlNodes, lang.hitch(this, function (node) {
        switch (type) {
          case 'single':
            single = true;
            //TODO this would not work correctly if multiple single fields are enabled
            this.myCsvStore.addrFieldName = node.selectFields.value;
            fields.push({ keyField: node.keyField, value: node.selectFields.value, label: node.label });
            break;
          case 'xy':
            if (node.keyField === this.nls.xyFieldsLabelX) {
              this.myCsvStore.xFieldName = node.selectFields.value;
              break;
            }
            if (node.keyField === this.nls.xyFieldsLabelY) {
              this.myCsvStore.yFieldName = node.selectFields.value;
              break;
            }
            
          //case this.nls.xyFieldsLabelX: //TODO are these still ok...or can the user change? Thinking the usre should be able to change
          //  this.myCsvStore.xFieldName = node.selectFields.value;
          //  break;
          //case this.nls.xyFieldsLabelY: //TODO are these still ok...or can the user change? Thinking the usre should be able to change
          //  this.myCsvStore.yFieldName = node.selectFields.value;
          //  break;
          default:
            multi = true;
            fields.push({ keyField: node.keyField, value: node.selectFields.value, label: node.label });
            break;
        }
      }));
      this.myCsvStore.multiFields = multi ? fields : this.myCsvStore.multiFields;
      this.myCsvStore.singleFields = single ? fields : this.myCsvStore.singleFields;
    },

    onUpdateClick: function () {
      var fl = this.myCsvStore.featureLayer;
      var unMatchedFL = this.myCsvStore.unMatchedFeatureLayer;

      //TODO
      alert('Update local map features based on changes to field mapping');
    },

    toggleContainer: function (e) {
      var container = this[e.currentTarget.dataset.clickParams];
      var removeClass = domClass.contains(container, 'content-show') ? 'content-show' : 'content-hide';
      domClass.remove(container, removeClass);
      domClass.add(container, removeClass === 'content-show' ? 'content-hide' : 'content-show');

      var accordian = container.previousElementSibling;
      if (domClass.contains(accordian, 'bottom-radius')) {
        domStyle.set(accordian, 'border-radius', removeClass === 'content-hide' ? '0 0 0 0' : '0 0 4px 4px');
      }

      domClass.remove(accordian.children[1], removeClass === 'content-hide' ? 'image-down' : 'image-up');
      domClass.add(accordian.children[1], removeClass === 'content-hide' ? 'image-up' : 'image-down');
    },

    onClearClick: function () {
      domStyle.set(this.clearMapData, "display", "none");
      domStyle.set(this.submitData, "display", "none");
      domStyle.set(this.updateData, "display", "none");
      domStyle.set(this.addToMap, "display", "block");

      domStyle.set(this.mainContainer, "display", "none");
      domStyle.set(this.schemaMapInstructions, "display", "block");

      domStyle.set(this.processingNode, 'display', 'none');
      this._toggleUnmatched(false);

      this.myCsvStore.clear();
    },

    onSubmitClick: function () {
      var featureLayer = this.myCsvStore.featureLayer;
      var oidField = this.myCsvStore.objectIdField;
      var flayer = this.editLayer;
      var features = [];
      array.forEach(featureLayer.graphics, function (feature) {
        if (feature.attributes.hasOwnProperty(oidField)) {
          delete feature.attributes[oidField];
        }
        if (feature.attributes.hasOwnProperty("_graphicsLayer")) {
          delete feature._graphicsLayer;
        }
        if (feature.attributes.hasOwnProperty("_layer")) {
          delete feature._layer;
        }
        features.push(feature);
      });
      flayer.applyEdits(features, null, null, function (e) {
        console.log(e);
      }, function (err) {
        console.log(err);
        new Message({
          message: this.nls.saveError
        });
      });
    }
  });
});