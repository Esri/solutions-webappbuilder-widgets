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
  'dojo/dom-class',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./templates/Addresses.html',
  'dijit/form/Select',
  'dijit/form/RadioButton'
],
  function (declare,
    lang,
    array,
    domConstruct,
    domClass,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    Select) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-addresses',
      declaredClass: 'CriticalFacilities.Addresses',
      templateString: template,
      _started: null,
      label: 'Addresses',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      singleFields: [],
      multiFields: [],
      fields: [],
      useSingle: true,
      useMulti: false,
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      //TODO need to discuss with team what to do when the locator only supports one of the options
      //...single or multi...should it be grayed out or not visible at all?

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initControls();
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
      },

      onShown: function () {
        this.pageContainer.nextDisabled = false;
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView(result));
        } else if (type === 'back-view') {
          def.resolve(this._backView(result));
        } else {
          def.resolve(this._homeView(result));
        }
        return def;
      },

      _updateAltIndexes: function () {
        if (this.pageContainer && !this._startPageView) {
          this._startPageView = this.pageContainer.getViewByTitle('StartPage');
          this._locationTypeView = this.pageContainer.getViewByTitle('LocationType');

          if (this._startPageView && this._locationTypeView) {
            this.altNextIndex = this._startPageView.index;
            this.altBackIndex = this._locationTypeView.index;
          }
        }
      },

      _nextView: function (nextResult) {
        if (nextResult.currentView.label === this.label) {
          var results = this._getResults();
          var hasResult = false;
          array.forEach(results.fields, function (f) {
            if (typeof (f.value) !== 'undefined' && f.value !== null && f.value !== '') {
              hasResult = true;
            }
          });
          this.parent._locationMappingComplete = hasResult;
          this.emit('location-mapping-update', hasResult);
        }
        return true;
      },

      _backView: function (backResult) {
        if (backResult.currentView.label === this.label) {
          this.parent._locationMappingComplete = false;
          this.emit('location-mapping-update', false);
        }
        return true;
      },

      _homeView: function (backResult) {
        var def = new Deferred();
        var homeView = this.pageContainer.getViewByTitle('Home');
        homeView.verifyClearSettings(backResult).then(function (v) {
          def.resolve(v);
        });
        return def;
      },

      _rdoSingleAddressClick: function () {
        this.rdoSingleAddress.set('checked', true);
      },

      _rdoSingleAddressChanged: function (v) {
        this.useSingle = v;
        this._toggleVisibility(this.singleFieldTable, v);
      },

      _rdoMultiAddressClick: function () {
        this.rdoMultiAddress.set('checked', true);
      },

      _rdoMultiAddressChanged: function (v) {
        this.useMulti = v;
        this._toggleVisibility(this.multiFieldTable, v);
      },

      _toggleVisibility: function (table, v) {
        var addClass = v ? 'display-table-row-group' : 'display-none';
        if (!domClass.contains(table, addClass)) {
          domClass.add(table, addClass);
        }

        var removeClass = v ? 'display-none' : 'display-table-row-group';
        if (domClass.contains(table, removeClass)) {
          domClass.remove(table, removeClass);
        }
      },

      _initControls: function () {
        //If only single or only multi is supported by the locator only add the appropriate one
        // If they are both supported add both
        var singleSupport = this.singleFields.length > 0 ? true : false;
        var multiSupport = this.multiFields.length > 0 ? true : false;

        if (singleSupport && multiSupport) {
          //will need to construct these also

          this.rdoSingleAddress.set('checked', this.useSingle);
          this._toggleVisibility(this.singleFieldTable, this.useSingle);

          this.rdoMultiAddress.set('checked', this.useMulti);
          this._toggleVisibility(this.multiFieldTable, this.useMulti);

          this._setFields(this.singleFields, this.fields, this.singleFieldTable);
          this._setFields(this.multiFields, this.fields, this.multiFieldTable);

        } else if (singleSupport) {
          //no need to construct radio button
          this._setFields(this.singleFields, this.fields, this.singleFieldTable);
        } else if (multiSupport) {
          //no need to construct radio button
          this._setFields(this.multiFields, this.fields, this.multiFieldTable);
        }
      },

      _setFields: function (controlFields, fields, table) {
        //Create UI for field controls
        var id = 0;
        array.forEach(controlFields, lang.hitch(this, function (controlField) {
          var tr = domConstruct.create('tr', { }, table);
          tr.keyField = controlField.value;
          tr.label = controlField.label;

          var tdLabel = domConstruct.create('td', {
            className: id === 0 ? "sub-field-control-td" : "field-control-td"
          }, tr);
          domConstruct.create('div', {
            className: "main-text float-left min-width-80",
            innerHTML: controlField.label
          }, tdLabel);

          var tdControl = domConstruct.create('td', {
            className: id === 0 ? "sub-field-control-td" : "field-control-td"
          }, tr);

          var fieldSelect = new Select({
            name: "field" + id,
            fieldName: controlField.label, //TODO does this need to update to be the same as teh rows keyField
            className: "field-control"
          });

          var options = [{
            label: this.nls.warningsAndErrors.noValue,
            value: this.nls.warningsAndErrors.noValue
          }];

          var defaultFieldName = this._getDefaultFieldName(fields, controlField);
          array.forEach(fields, function (f) {
            options.push({
              label: f.label,
              value: f.value,
              selected: f.value === defaultFieldName
            });
          });

          fieldSelect.addOption(options);

          fieldSelect.placeAt(tdControl);
          fieldSelect.startup();
          tr.fieldControl = fieldSelect;
          id += 1;

          if (controlFields.length > 1) {
            domClass.add(tr, 'bottom-border');
          }
        }));
      },

      _getDefaultFieldName: function (fields, configField) {
        var isRecognizedValues = configField.isRecognizedValues;
        for (var i = 0; i < isRecognizedValues.length; i++) {
          var isRecognizedValue = isRecognizedValues[i];
          for (var ii = 0; ii < fields.length; ii++) {
            var field = fields[ii];
            if (field.value.toString().toUpperCase() === isRecognizedValue.toString().toUpperCase()) {
              return field.value;
            }
          }
        }
        return;
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateImageNodes: function () {
        //TODO toggle white/black images
      },

      updateTheme: function (theme) {
        this.theme = theme;
      },

      _getResults: function () {
        var table = this.useSingle ? this.singleFieldTable : this.multiFieldTable;

        var rows = table.rows;
        var fields = [];
        var mappedArrayFields = {};
        var noValue = this.nls.warningsAndErrors.noValue;
        array.forEach(rows, function (r) {
          var sourceField = r.fieldControl.get('value');
          var targetField = r.label;
          var keyField = r.keyField;
          if (sourceField !== noValue) {
            fields.push({
              keyField: keyField,
              value: sourceField,
              label: targetField
            });
            mappedArrayFields[keyField] = sourceField;
          } else {
            fields.push({
              keyField: keyField,
              value: undefined,
              label: targetField
            });
            mappedArrayFields[keyField] = undefined;
          }
        });
        return {
          type: this.useSingle ? 'single' : 'multi',
          fields: fields,
          mappedArrayFields: mappedArrayFields
        };
      }
    });
  });