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
      _editToolbar: null,
      _featureQuery: null,
      _skipFields: [],

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
        this._skipFields.push("DestinationOID");
        this._skipFields.push("matchScore");
        this._skipFields.push(this.layer.objectIdField);
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
        //TODO need to think through this for duplicate details
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
          _editToolbar: this._editToolbar
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
              this._initValidationBox(tr, f.duplicateFieldInfo.value, false);
            }
            this._initValidationBox(tr, f.value, true);

            rowIndex += 1;
          }
        }));
      },

      _initValidationBox: function (tr, value, isFile) {
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
        valueTextBox.row = tr;
        valueTextBox.parent = this;
        if (isFile) {
          tr.fileValueTextBox = valueTextBox;
          tr.fileValue = value;
        } else {
          tr.layerValueTextBox = valueTextBox;
          tr.layerValue = value;
        }

        valueTextBox.on("keyUp", function (v) {
          var newValue = v.srcElement.value;
          var valueChanged = this.isFile ? newValue !== this.row.fileValue : newValue !== this.row.layerValue;
          var changeIndex = this.parent._changedAttributeRows.indexOf(this.row.rowIndex);
          if (changeIndex === -1 && valueChanged) {
            this.parent._changedAttributeRows.push(this.row.rowIndex);
          } else if (changeIndex > -1 && !valueChanged) {
            this.parent._changedAttributeRows.splice(changeIndex, 1);
          }
          this.parent.emit('attribute-change', this.parent._changedAttributeRows.length > 0);
        });
      },

      _validateValues: function () {
        //this function is used to test when duplicate and you switch the state of the rdo for use values
        this._changedAttributeRows = [];
        array.forEach(this.featureControlTable.rows, lang.hitch(this, function (row) {
          if (row.isEditRow) {
            if (row.parent._useValuesFromFile) {
              if (row.fileValueTextBox.value !== row.fileValue) {
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
      },

      _validateGeoms: function () {
        var editX = this._editFeature.geometry.x;
        var editY = this._editFeature.geometry.y;

        var featureX = this._feature.geometry.x;
        var featureY = this._feature.geometry.y;
        return editX === featureX && editY === featureY;
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
          this._panToAndSelectFeature(this._fileFeature);
        }
        var isSaveDisabled = !(this._featureToolbar._hasAttributeEdit || this._featureToolbar._hasGeometryEdit);
        this._featureToolbar._updateSave(isSaveDisabled);
      },

      _rdoGeomFromLayerChanged: function (v) {
        this._useGeomFromLayer = v;
        if (v) {
          this._panToAndSelectFeature(this._layerFeature);
        }
        var isSaveDisabled = !(this._featureToolbar._hasAttributeEdit || this._featureToolbar._hasGeometryEdit);
        this._featureToolbar._updateSave(isSaveDisabled);
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
        //this.feature = feature;
        this._featureToolbar.feature = this.feature;
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
      },

      _getEditValues: function () {
        var edits = {};
        var editIndexes = this._changedAttributeRows;
        var useFile = this._useValuesFromFile;
        array.forEach(this.featureControlTable.rows, function (row) {
          if (row.isEditRow && editIndexes.indexOf(row.rowIndex) > -1) {
            if (row.parent.isDuplicate) {
              edits[row.fieldName] = useFile === 'file' ? row.fileValueTextBox.value : row.layerValueTextBox.value;
            } else {
              edits[row.fieldName] = row.fileValueTextBox.value;
            }
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