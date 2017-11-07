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
  'dojo/_base/html',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/dom-class',
  'dojo/on',
  'dijit/form/ValidationTextBox',
  'dijit/form/RadioButton',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./templates/Feature.html',
  './FeatureToolbar',
  'esri/graphic',
  'esri/geometry/Point',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/PictureMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleFillSymbol',
  'esri/Color',
  'dojox/gfx/fx'
],
  function (declare,
    lang,
    html,
    array,
    domConstruct,
    domStyle,
    domClass,
    on,
    ValidationTextBox,
    RadioButton,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    FeatureToolbar,
    Graphic,
    Point,
    SimpleMarkerSymbol,
    PictureMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Color,
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
      isDuplicate: false,
      _useGeomFromFile: true,
      _useGeomFromLayer: false,
      _useValuesFromFile: true,
      _useValuesFromLayer: false,
      theme: '',
      isDarkTheme: '',
      styleColor: 'black',
      _fileFeature: null,
      _layerFeature: null,
      layer: null,

      //TODO validation logic for each control should be defined based on field type from layer

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this.fields = this._getFields(this.feature);
        this._initToolbar(this.featureToolbar);
        this._initRows(this.fields, this.featureControlTable, this.layer);
      },

      startup: function () {
        console.log('Feature startup');
        this._started = true;
        this._updateAltIndexes();
        this._panToAndSelectFeature(this.feature);
      },

      onShown: function () {
        this._panToAndSelectFeature(this.feature);
      },

      _updateAltIndexes: function () {
        //if (this.pageContainer && !this._featureListView) {
        //  this._featureListView = this.pageContainer.getViewByTitle();

        //  if (this._featureListView) {
        //    this.altBackIndex = this._featureListView.index;
        //  }
        //}
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
          layer: this.layer
        });

        this._featureToolbar.placeAt(this.featureToolbar);

        this._featureToolbar.startup();
      },

      _getFields: function (feature) {
        return feature.fieldInfo;
      },

      _initRows: function (fields, table, layer) {
        if (this.isDuplicate) {
          this._initRadioButtonRows(this.nls.review.useGeometry, table);
          this._initRadioButtonRows(this.nls.review.useValues, table);
        }

        var oidFieldName = layer.objectIdField;
        //Create UI for field controls
        array.forEach(fields, lang.hitch(this, function (f) {
          if (f.name !== oidFieldName) {
            var tr = domConstruct.create('tr', {
              className: "control-row bottom-border",
              isRadioRow: false
            }, table);

            var tdLabel = domConstruct.create('td', {
              className: "pad-right-10 pad-left-10 label-td"
            }, tr);
            domConstruct.create('div', {
              className: "main-text float-left",
              innerHTML: f.label
            }, tdLabel);

            this._initValidationBox(tr, f.value, false);

            if (this.isDuplicate) {
              this._initValidationBox(tr, f.duplicateFieldInfo.value, true);
            }
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
          }
        });
        valueTextBox.set("value", value);
        valueTextBox.placeAt(tdControl);
        valueTextBox.startup();
        if (isFile) {
          tr.fileValueTextBox = valueTextBox;
        } else {
          tr.layerValueTextBox = valueTextBox;
        }
      },

      _initRadioButtonRows: function (useString, table) {
        var fromLayer = this.nls.review.fromLayer;
        var fromFile = this.nls.review.fromFile;

        var tr = domConstruct.create('tr', {
          className: "radio-row task-instruction-row bottom-border",
          isRadioRow: true
        }, table);

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
      },

      _rdoGeomFromLayerChanged: function (v) {
        this._useGeomFromLayer = v;
        if (v) {
          this._panToAndSelectFeature(this._layerFeature);
        }
      },

      _rdoValuesFromFileChanged: function (v) {
        this._useValuesFromFile = v;
        if (v) {
          this._toggleEnabled(true);
        }
      },

      _rdoValuesFromLayerChanged: function (v) {
        this._useValuesFromLayer = v;
        if (v) {
          this._toggleEnabled(false);
        }
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
        this.feature = feature;
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
          this.map.centerAt(geom).then(lang.hitch(this, function (ext) {
            this._flashFeature(feature);
            if ((feature._layer && feature._layer.infoTemplate) || feature.infoTemplate) {
              this.map.infoWindow.setFeatures([feature]);
              this.map.infoWindow.select(0);
              this.map.infoWindow.show(geom);
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