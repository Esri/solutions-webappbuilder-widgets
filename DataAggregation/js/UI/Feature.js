///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
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

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/on',
  'dijit/form/ValidationTextBox',
  'dijit/form/RadioButton',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./templates/Feature.html',
  'dojo/Deferred',
  './FeatureToolbar',
  'esri/graphic',
  'esri/geometry/Point',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleFillSymbol',
  'esri/dijit/PopupTemplate',
  'esri/Color',
  'esri/layers/FeatureLayer',
  'esri/tasks/query',
  'jimu/dijit/Message',
  'dojox/gfx/fx'
],
  function (declare,
    lang,
    array,
    domConstruct,
    on,
    ValidationTextBox,
    RadioButton,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    Deferred,
    FeatureToolbar,
    Graphic,
    Point,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    PopupTemplate,
    Color,
    FeatureLayer,
    Query,
    Message,
    fx) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-feature',
      declaredClass: 'CriticalFacilities.Feature',
      templateString: template,
      _started: null,
      label: 'Feature',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      _featureToolbar: null,
      fields: [],
      feature: null,
      fileAddress: {}, //TODO need to make this work..for now since we have not discussed exposing the address fields...just store the address details here so they could be passed to the toolbar to support locate
      isDuplicate: false,
      _useGeomFromFile: false,
      _useGeomFromLayer: true,
      _useValuesFromFile: false,
      _useValuesFromLayer: true,
      theme: '',
      isDarkTheme: '',
      styleColor: 'black',
      _fileFeature: null,
      _layerFeature: null,
      layer: null,
      _changedAttributeRows: [],
      _changedAddressRows: [],
      _editToolbar: null,
      _featureQuery: null,
      _skipFields: [],
      csvStore: null, //used to get _geocodeSources for reverse geocode

      //TODO validation logic for each control should be defined based on field type from layer
      //TODO seems like for duplicate the validation txt boxes should be on seperate rows
      //TODO for duplicate you need to keep track of if file vs layer have differences then enable save based on differenec when rdo switch

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this.fields = this._getFields(this.feature);
        this._initPopup(this.fields);
        this._initToolbar(this.featureToolbar);
        this._initSkipFields();
        this._initRows(this.fields, this.featureControlTable);
      },

      _initSkipFields: function () {
        //these fields are needed for interactions with the feature but should not be shown in the UI
        // nor should they be persisted with the layer or shown in the popup
        this._skipFields = ["DestinationOID", "matchScore", this.layer.objectIdField];
        array.forEach(this.fields, lang.hitch(this, function (f) {
          if (f.name.indexOf("MatchField_") > -1) {
            this._skipFields.push(f.name);
          }
        }));
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
        this._getFeature().then(lang.hitch(this, function (f) {
          this._feature = f;
          this._panToAndSelectFeature(f);
        }));
        this._getEditLayerFeature().then(lang.hitch(this, function (f) {
          this._editFeature = f;
        }));

        this._toggleEditControls(typeof (this._featureToolbar._editDisabled) === 'undefined' ?
          true : this._featureToolbar._editDisabled);

        //TODO what did I start this for...
        var score;
        for (var i = 0; i < this.feature.fieldInfo.length; i++) {
          var fi = this.feature.fieldInfo[i];
          if (fi.name === 'matchScore') {
            score = fi.value;
          }
        }
      },

      onShown: function () {
        this._toggleEditControls(typeof (this._featureToolbar._editDisabled) === 'undefined' ?
          true : this._featureToolbar._editDisabled);
        this._panToAndSelectFeature(this._feature);
      },

      _updateAltIndexes: function () {
        //if (this.pageContainer && !this._featureListView) {
        //  this._featureListView = this.pageContainer.getViewByTitle();

        //  if (this._featureListView) {
        //    this.altBackIndex = this._featureListView.index;
        //  }
        //}
      },

      _getFeature: function () {
        var def = new Deferred();
        var oidFieldName = this.layer.objectIdField;
        var oidField = this.feature.fieldInfo.filter(function (f) {
          return f.name === oidFieldName;
        });

        this._featureQuery = new Query();
        this._featureQuery.objectIds = [oidField[0].value];

        this.layer.queryFeatures(this._featureQuery).then(lang.hitch(this, function (f) {
          def.resolve(f.features[0]);
        }));
        return def;
      },

      _getEditLayerFeature: function () {
        var def = new Deferred();
        var destinationOID = 'DestinationOID';
        var destinationOIDField = this.feature.fieldInfo.filter(function (f) {
          return f.name === destinationOID;
        });
        if (destinationOIDField && destinationOIDField.length > 0) {
          this._editQuery = new Query();
          this._editQuery.objectIds = [destinationOIDField[0].value];

          this.parent.editLayer.queryFeatures(this._editQuery).then(lang.hitch(this, function (f) {
            def.resolve(f.features[0]);
          }));
        } else {
          def.resolve();
        }
        return def;
      },

      _initPopup: function (fields) {
        var content = { title: this.feature.label };

        var fieldInfos = [];
        array.forEach(fields, lang.hitch(this, function (f) {
          if (f.name !== this.layer.objectIdField) {
            fieldInfos.push({ fieldName: f.name, visible: true });
          }
        }));
        content.fieldInfos = fieldInfos;
        this.layer.infoTemplate = new PopupTemplate(content);
      },

      _initToolbar: function (domNode) {
        this._featureToolbar = new FeatureToolbar({
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          feature: this.feature,
          theme: this.theme,
          layer: this.layer,
          featureView: this,
          _editToolbar: this._editToolbar,
          csvStore: this.csvStore
        });

        this._featureToolbar.placeAt(domNode);

        this._featureToolbar.startup();
      },

      _getFields: function (feature) {
        return feature.fieldInfo;
      },

      _initRows: function (fields, table) {
        if (this.isDuplicate) {
          this._initRadioButtonRows(this.nls.review.useGeometry, table);
          this._initRadioButtonRows(this.nls.review.useValues, table);
        }

        var rowIndex = 0;
        //Create UI for field controls
        array.forEach(fields, lang.hitch(this, function (f) {
          if (this._skipFields.indexOf(f.name) === -1) {
            var tr = domConstruct.create('tr', {
              className: "control-row bottom-border",
              isRadioRow: false,
              isEditRow: true,
              rowIndex: rowIndex
            }, table);
            tr.fieldName = f.name;
            tr.parent = this;
            var tdLabel = domConstruct.create('td', {
              className: "pad-right-10 pad-left-10 label-td"
            }, tr);
            domConstruct.create('div', {
              className: "main-text float-left",
              innerHTML: f.label
            }, tdLabel);

            if (this.isDuplicate) {
              this._initValidationBox(tr, f.duplicateFieldInfo.value, false, false);
            }
            this._initValidationBox(tr, f.value, true, false);

            rowIndex += 1;
          }
        }));

        //Create UI for location field control
        //this.locationControlTable

        //check and see if we can get the address field info we need from csvStore info
        // check csvStore useMultiFields and multiFields



        this.addressFields = this.csvStore.useMultiFields ? this.csvStore.multiFields : this.csvStore.useAddr ?
          this.csvStore.singleFields : this.getXYFields(); //finally should be the xy fields

        array.forEach(this.addressFields, lang.hitch(this, function (f) {
          var tr = domConstruct.create('tr', {
            className: "control-row bottom-border",
            isRadioRow: false,
            isEditRow: false,
            isAddressRow: true
          }, this.locationControlTable);
          tr.label = f.label;
          tr.keyField = f.keyField;
          tr.parent = this;
          var tdLabel = domConstruct.create('td', {
            className: "pad-right-10 pad-left-10 label-td"
          }, tr);
          domConstruct.create('div', {
            className: "main-text float-left",
            innerHTML: f.label
          }, tdLabel);
                 
          var field = this.feature.fieldInfo.filter(function (fieldInfo) {
            return fieldInfo.name === "MatchField_" + f.keyField;
          });

          this._initValidationBox(tr, field[0].value, false, true);
        }));
      },

      getXYFields: function () {
        this._featureToolbar._isAddressFeature = false;
        var coordinatesView = this.parent._pageContainer.getViewByTitle('Coordinates');
        var xField = coordinatesView.xField;
        var yField = coordinatesView.yField;

        this._featureToolbar.xField = this.csvStore.xFieldName;
        this._featureToolbar.yField = this.csvStore.yFieldName;
        return [{
          keyField: this.csvStore.xFieldName,
          label: xField.label,
          value: this.csvStore.xFieldName
        }, {
            keyField: this.csvStore.yFieldName,
          label: yField.label,
          value: this.csvStore.yFieldName
        }];
      },

      _updateAddressFields: function (address) {
        this._address = address;
        //use the located address to update whatever fileds we have displayed
        array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
          row.addressValueTextBox.set('value', this._address[row.keyField]);
        }));
      },

      _updateFeature: function (location, address) {
        //TODO when a new feature is generated from locate we need to update the local instances
        //this will include the local feature instance that is disconnected from the layer and also the layer instance
        //this will also include the attribute values for the local features that currently store the address

        //need to make sure the feature toolbar instances are updated as well

        //may be better to do this in the toolbar

        this.feature.geometry = location;
        this._feature.geometry = location;

        //apply the edits 
        this.layer.applyEdits(null, [this._feature]).then(lang.hitch(this, function (result) {
         // this._featureToolbar._hasAttributeEdit = false;
          this._panToAndSelectFeature(this._feature);
          this.emit('address-located');
        }, lang.hitch(this, function (err) {
            console.log(err);
            new Message({
              message: this.nls.warningsAndErrors.saveError
            });
        })));
      },

      _getAddressFieldsValues: function () {
        //get the address or coordinates from the 
        var address = {};
        array.forEach(this.locationControlTable.rows, function (row) {
          address[row.keyField] = row.addressValueTextBox.value;
        });
        return address;
      },

      _initValidationBox: function (tr, value, isFile, isAddress) {
        var tdControl = domConstruct.create('td', {
          className: !isFile ? 'pad-right-10' : ''
        }, tr);
        var valueTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "30px"
          },
          title: value
        });
        valueTextBox.set("value", value);
        valueTextBox.placeAt(tdControl);
        valueTextBox.startup();
        valueTextBox.isFile = isFile;
        valueTextBox.isAddress = isAddress;
        valueTextBox.row = tr;
        valueTextBox.parent = this;
        if (isFile) {
          tr.fileValueTextBox = valueTextBox;
          tr.fileValue = value;
        } else if (isAddress) {
          tr.addressValueTextBox = valueTextBox;
          tr.addressValue = value;
        } else {
          tr.layerValueTextBox = valueTextBox;
          tr.layerValue = value;
        }

        valueTextBox.on("keyUp", function (v) {
          //TODO update this to handle address change

          var newValue = v.srcElement.value;
          if (this.isAddress) {
            var valueChanged = newValue !== this.row.addressValue;
            var changeIndex = this.parent._changedAddressRows.indexOf(this.row.rowIndex);
            if (changeIndex === -1 && valueChanged) {
              this.parent._changedAddressRows.push(this.row.rowIndex);
            } else if (changeIndex > -1 && !valueChanged) {
              this.parent._changedAddressRows.splice(changeIndex, 1);
            }
            this.parent.emit('address-change', this.parent._changedAddressRows.length > 0);
          } else {
            var valueChanged = this.isFile ? newValue !== this.row.fileValue : newValue !== this.row.layerValue;
            var changeIndex = this.parent._changedAttributeRows.indexOf(this.row.rowIndex);
            if (changeIndex === -1 && valueChanged) {
              this.parent._changedAttributeRows.push(this.row.rowIndex);
            } else if (changeIndex > -1 && !valueChanged) {
              this.parent._changedAttributeRows.splice(changeIndex, 1);
            }
            this.parent.emit('attribute-change', this.parent._changedAttributeRows.length > 0);
          }
        });
      },

      _validateValues: function () {
        //this function is used to test when duplicate and you switch the state of the rdo for use values
        this._changedAttributeRows = [];
        array.forEach(this.featureControlTable.rows, lang.hitch(this, function (row) {
          if (row.isEditRow) {
            if (row.parent._useValuesFromFile) {
              if (row.fileValueTextBox.value !== row.fileValue || row.fileValueTextBox.value !== row.layerValue) {
                this._changedAttributeRows.push(row.rowIndex);
              }
            }
            if (row.parent._useValuesFromLayer) {
              if (row.layerValueTextBox.value !== row.layerValue) {
                this._changedAttributeRows.push(row.rowIndex);
              }
            }
          }
        }));
        this.emit('attribute-change', this._changedAttributeRows.length > 0);

        //check the address rows
        this._changedAddressRows = [];
        array.forEach(this.locationControlTable.rows, lang.hitch(this, function (row) {
          if (row.isAddressRow) {
            if (row.addressValueTextBox.value !== row.addressValue) {
              this._changedAddressRows.push(row.rowIndex);
            }
          }
        }));
        this.emit('attribute-change', this._changedAddressRows.length > 0);
      },

      _validateGeoms: function () {
        var aEdit = this._featureToolbar._hasAttributeEdit;
        var gEdit = this._featureToolbar._hasGeometryEdit;
        if (!this._useGeomFromLayer) {
          //when using geom from file only attributes matter unless we have a geom edit
          if (gEdit) {
            this._featureToolbar._updateSave(!aEdit && !gEdit);
          } else {
            this._featureToolbar._updateSave(!aEdit);
          }
        } else {
          //when useing geom from layer only attribute edits matter
          this._featureToolbar._updateSave(!aEdit);
        }
      },

      _initRadioButtonRows: function (useString, table) {
        var tr = domConstruct.create('tr', {
          className: "radio-row task-instruction-row bottom-border",
          isRadioRow: true,
          isEditRow: false
        }, table);
        tr.radioButtons = [];

        var tdUseLabel = domConstruct.create('td', {}, tr);
        domConstruct.create('div', {
          className: "main-text float-left pad-left-10",
          innerHTML: useString
        }, tdUseLabel);
        var isGeom = useString === this.nls.review.useGeometry;

        //from layer
        this._initRadioButton(tr, useString, this.nls.review.fromLayer,
          isGeom ? this._rdoGeomFromLayerChanged : this._rdoValuesFromLayerChanged);

        //from file
        this._initRadioButton(tr, useString, this.nls.review.fromFile,
          isGeom ? this._rdoGeomFromFileChanged : this._rdoValuesFromFileChanged);

      },

      _initRadioButton: function (tr, useString, fromString, func) {
        var tdFromControl = domConstruct.create('td', {}, tr);
        var rdoFrom = new RadioButton({
          title: useString + " " + fromString,
          name: useString
        });
        rdoFrom.placeAt(tdFromControl);
        rdoFrom.startup();
        tr.radioButtons.push(rdoFrom);

        this.own(on(rdoFrom, 'change', lang.hitch(this, func)));
        domConstruct.create('div', {
          className: "main-text",
          innerHTML: fromString
        }, tdFromControl);

        rdoFrom.set('checked', fromString === this.nls.review.fromLayer);
      },

      _rdoGeomFromFileChanged: function (v) {
        this._useGeomFromFile = v;
        if (v) {
          this._panToAndSelectFeature(this._feature);
        }
        this._validateGeoms();
      },

      _rdoGeomFromLayerChanged: function (v) {
        this._useGeomFromLayer = v;
        if (v) {
          this._panToAndSelectFeature(this._editFeature);
        }
        this._validateGeoms();
      },

      _rdoValuesFromFileChanged: function (v) {
        this._useValuesFromFile = v;
        if (v && !this._featureToolbar._editDisabled) {
          this._toggleEnabled(true);
        }
        this._validateValues();
      },

      _rdoValuesFromLayerChanged: function (v) {
        this._useValuesFromLayer = v;
        if (v && !this._featureToolbar._editDisabled) {
          this._toggleEnabled(false);
        }
        this._validateValues();
      },

      _toggleEnabled: function (isFile) {
        array.forEach(this.featureControlTable.rows, function (row) {
          if (!row.isRadioRow) {
            row.fileValueTextBox.set('disabled', !isFile);
            row.layerValueTextBox.set('disabled', isFile);
          }
        });
      },

      _locateFileFeature: function (address) {
        this._fileFeature = this._featureToolbar.locateFeature(address);
      },

      _panToAndSelectFeature: function (feature) {
        //this._featureToolbar.feature = this.feature;
        if (feature && feature.geometry) {
          var geom = feature.geometry;
          if (geom.type === 'polyline') {
            var path = geom.paths[Math.ceil(geom.paths.length / 2) - 1];
            var g = path[Math.ceil((path.length - 1) / 2)];
            geom = new Point(g[0], g[1], geom.spatialReference);
          }
          if (geom.type !== 'point') {
            geom = geom.getExtent().getCenter();
          }
          this.map.centerAt(geom).then(lang.hitch(this, function () {
            this._flashFeature(feature);
            if ((feature._layer && feature._layer.infoTemplate) || feature.infoTemplate) {
              this.map.infoWindow.setFeatures([feature]);
              this.map.infoWindow.select(0);
            }
          }));
        }
      },

      _flashFeature: function (feature) {
        var symbol;
        if (feature.geometry) {
          var color = Color.fromHex(this.styleColor);
          var color2 = lang.clone(color);
          color2.a = 0.4;
          switch (feature.geometry.type) {
            case 'point':
              symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 15,
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                  color, 1),
                color2);
              break;
            case 'polyline':
              symbol = new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_SOLID,
                color,
                3
              );
              break;
            case 'polygon':
              symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_DIAGONAL_CROSS,
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                  color, 2), color2
              );
              break;
          }
        }

        var g = new Graphic(feature.geometry, symbol);
        this.map.graphics.add(g);
        var dShape = g.getDojoShape();
        if (dShape) {
          fx.animateStroke({
            shape: dShape,
            duration: 900,
            color: {
              start: dShape.strokeStyle.color,
              end: dShape.strokeStyle.color
            },
            width: {
              start: 25,
              end: 0
            }
          }).play();
          setTimeout(this._clearFeature, 1075, g);
        }
      },

      _selectFeature: function () {
        this.layer.selectFeatures(this._featureQuery, FeatureLayer.SELECTION_NEW).then(lang.hitch(this, function (f) {
          console.log(f);
        }));
      },

      _toggleEditControls: function (disabled) {
        array.forEach(this.featureControlTable.rows, function (row) {
          if (row.isRadioRow) {
            array.forEach(row.radioButtons, function (btn) {
              btn.set('disabled', disabled);
            });
          }
          if (row.isEditRow) {
            if (row.fileValueTextBox) {
              if (disabled) {
                row.fileValueTextBox.set('disabled', disabled);
              } else if (row.parent.isDuplicate && row.parent._useValuesFromFile){
                row.fileValueTextBox.set('disabled', disabled);
              } else if (!row.parent.isDuplicate) {
                row.fileValueTextBox.set('disabled', disabled);
              }
            }
            if (row.layerValueTextBox) {
              if (disabled) {
                row.layerValueTextBox.set('disabled', disabled);
              } else if (row.parent.isDuplicate && row.parent._useValuesFromLayer){
                row.layerValueTextBox.set('disabled', disabled);
              } else if (!row.parent.isDuplicate) {
                row.layerValueTextBox.set('disabled', disabled);
              }
            }
          }
        });

        //address rows
        array.forEach(this.locationControlTable.rows, function (row) {
          if (row.isAddressRow) {
            if (row.addressValueTextBox) {
              row.addressValueTextBox.set('disabled', disabled);
            }
          }
        });
      },

      _getEditValues: function () {
        var edits = {_rows: []};

        var editIndexes = this._changedAttributeRows;
        var useFile = this._useValuesFromFile;
        array.forEach(this.featureControlTable.rows, function (row) {
          if (row.isEditRow && editIndexes.indexOf(row.rowIndex) > -1) {
            if (row.parent.isDuplicate) {
              edits[row.fieldName] = useFile ? row.fileValueTextBox.value : row.layerValueTextBox.value;
              row.useFile = useFile;
            } else {
              edits[row.fieldName] = row.fileValueTextBox.value;
            }
            edits._rows.push(row);
          }
        });
        return edits;
      },

      _getAddressValues: function () {

      },

      _clearFeature: function (f) {
        var gl = f.getLayer();
        gl.remove(f);
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }

    });
  });