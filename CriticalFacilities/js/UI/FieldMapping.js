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
  'dojo/dom-class',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./FieldMapping.html',
  'jimu/dijit/SimpleTable',
  'dijit/form/Select'
],
  function (declare,
    lang,
    html,
    array,
    domConstruct,
    domClass,
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
        console.log('FieldMapping startup');
      },

      onShown: function () {
        console.log('FieldMapping shown');
      },

      _initFieldsTable: function () {
        var fields = [{
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

      _createSelect: function (td) {
        var fieldsSelect = new Select({
          style: {
            display: "table",
            width: "100%",
            height: "28px"
          }
        });
        array.forEach(this.sourceFields, function (f) {
          //TODO needs to support the isRecognized list
          // set selected true for the correct one
          fieldsSelect.addOption({
            label: f.label,
            value: f.value
          });
        });

        td.fieldsSelect = fieldsSelect;
        domConstruct.place(fieldsSelect.domNode, td);
        domClass.add(td, 'float-left');
        domClass.add(td, 'width-all');
      },

      _getSelectValue: function () {
        return td.fieldsSelect.get('value');
      },

      _setSelectValue: function (td, value) {
        td.fieldsSelect.set('value', value);
      },

      _initFields: function (targetFields) {
        array.forEach(targetFields, lang.hitch(this, function (targetField) {
          var result = this._fieldsTable.addRow({
            target: targetField.label
          });
        }));
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateImageNodes: function () {
        //TODO toggle white/black images
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }

    });
  });