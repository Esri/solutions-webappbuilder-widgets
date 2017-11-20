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
  'dojo/text!./templates/FieldMapping.html',
  'jimu/dijit/SimpleTable',
  'dijit/form/Select'
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
    SimpleTable,
    Select) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-field-mapping',
      declaredClass: 'CriticalFacilities.FieldMapping',
      templateString: template,
      _started: null,
      label: 'FieldMapping',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      targetFields: [],
      sourceFields: [],
      _fieldsTable: null,
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initFieldsTable();
        this._initFields(this.targetFields);
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
      },

      onShown: function () {
      },

      _updateAltIndexes: function () {
        //No gaurentee that page container will exist prior to when the view is created
        // However, it must exist for the page to be shown
        if (this.pageContainer && !this._startPageView) {
          //this.own(on(this.pageContainer, 'next-view', lang.hitch(this, this._nextView)));
          //this.own(on(this.pageContainer, 'back-view', lang.hitch(this, this._backView)));

          this._startPageView = this.pageContainer.getViewByTitle('StartPage');

          if (this._startPageView) {
            this.altNextIndex = this._startPageView.index;
            this.altBackIndex = this._startPageView.index;
          }
        }
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView(result));
        } else if (type === 'back-view') {
          def.resolve(this._backView(result));
        }
        return def;
      },

      _nextView: function (nextResult) {
        //The assumption is that if they click next the definition of mapping is complete
        //  This may need a better approach to evaluate when it is actually complete rather than just when they have clicked next
        //  Need to keep in mind that they could have the auto recognized fields established and never have to click a select control
        if (nextResult.currentView.label === this.label) {
          this.parent._fieldMappingComplete = true;
          var results = this._getResults();
          this.emit('field-mapping-update', true, results);
        }
        return true;
      },

      _backView: function (backResult) {
        //The assumption is that if they click back the definition of mapping is not complete
        //  This may need a better approach to evaluate when it is actually complete rather than just when they have clicked next or back
        //  Need to keep in mind that they could have the auto recognized fields established and never have to click a select control
        if (backResult.currentView.label === this.label) {
          this.parent._fieldMappingComplete = false;
          this.emit('field-mapping-update', false);
        }
        return true;
      },

      _initFieldsTable: function () {
        var fields = [{
          name: 'targetField',
          type: 'extension',
          hidden: true,
          create: lang.hitch(this, this._createTargetField),
          setValue: lang.hitch(this, this._setTargetFieldValue),
          getValue: lang.hitch(this, this._getTargetFieldValue)
        }, {
          name: 'target',
          title: this.nls.fieldMapping.targetField,
          type: 'text',
          'class': 'task-instruction-row'
        }, {
          name: 'label',
          title: this.nls.fieldMapping.sourceField,
          type: 'extension',
          hidden: false,
          create: lang.hitch(this, this._createSelect),
          setValue: lang.hitch(this, this._setSelectValue),
          getValue: lang.hitch(this, this._getSelectValue)
        }];
        this._fieldsTable = new SimpleTable({
          fields: fields,
          selectable: false,
          autoHeight: true
        });
        this._fieldsTable.placeAt(this.fieldMappingTable);
        this._fieldsTable.startup();
      },

      _createTargetField: function (td) {
        //do nothing
        console.log(td);
      },

      _setTargetFieldValue: function (td, value) {
        td.targetField = value;
      },

      _getTargetFieldValue: function (td) {
        return td.targetField;
      },

      _createSelect: function (td) {
        var fieldsSelect = new Select({
          style: {
            display: "table",
            width: "100%",
            height: "28px"
          }
        });

        var targetField = td.parentNode.cells[0].targetField;
        var fields = this._getSupportedFields(this.sourceFields, targetField.type);

        var options = [{
          label: this.nls.warningsAndErrors.noValue,
          value: this.nls.warningsAndErrors.noValue
        }];
        var defaultFieldName = this._getDefaultFieldName(fields, targetField);
        array.forEach(fields, function (f) {
          options.push({
            label: f.label,
            value: f.value,
            selected: defaultFieldName === f.value
          });
        });

        fieldsSelect.addOption(options);

        td.fieldsSelect = fieldsSelect;
        domConstruct.place(fieldsSelect.domNode, td);
        domClass.add(td, 'float-left');
        domClass.add(td, 'width-all');
      },

      _getSelectValue: function (td) {
        return td.fieldsSelect.get('value');
      },

      _setSelectValue: function (td, value) {
        td.fieldsSelect.set('value', value);
      },

      _initFields: function (targetFields) {
        array.forEach(targetFields, lang.hitch(this, function (targetField) {
          this._fieldsTable.addRow({
            target: targetField.label,
            targetField: targetField
          });
        }));
      },

      _getSupportedFields: function (fields, type) {
        var _fields = fields.filter(function (f) {
          //TODO fix issue with csvStore that leads to this not existing in some cases
          // should not have to do this test as field should always have a type captured
          if (f.type) {
            var _int = f.type.supportsInt;
            var flt = f.type.supportsFloat;
            return type === 'other' ? true : type === 'int' ? _int : type === 'float' ? flt : false;
          } else {
            return false;
          }
        });

        return _fields;
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
        var rows = this._fieldsTable.getRows();
        var results = {};
        var noValue = this.nls.warningsAndErrors.noValue;
        array.forEach(rows, function (r) {
          var value = r.cells[2].fieldsSelect.getValue();
          if (value !== noValue) {
            results[r.cells[0].targetField.name] = value;
          } else {
            results[r.cells[0].targetField.name] = undefined;
          }
        });

        return results;
      }
    });
  });