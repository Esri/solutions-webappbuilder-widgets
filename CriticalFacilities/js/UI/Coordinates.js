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
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'dojo/Evented',
  'dojo/text!./Coordinates.html',
  'dijit/form/Select',
  'dojo/_base/array'
],
  function (declare,
    lang,
    html,
    array,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    Select,
    array) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-coordinates',
      declaredClass: 'CriticalFacilities.Coordinates',
      templateString: template,
      _started: null,
      label: 'Coordinates',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      fields: [],
      xLabel: "",
      yLabel: "",
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this.lblX.innerHTML = this.xLabel + ":";
        this.lblY.innerHTML = this.yLabel + ":";
        this._setFields(this.fields);
      },

      startup: function () {
        console.log('Coordinates startup');
      },

      onShown: function () {
        console.log('Coordinates shown');
      },

      _setFields: function (fields) {
        //fields needs to look like this:
        //[{
        //  label: this.nls.miles,
        //  value: "miles",
        //  xSelected or ySelected: true
        //}, {...}]

        array.forEach(fields, lang.hitch(this, function (f) {
          this.selectX.addOption({
            label: f.label,
            value: f.value,
            selected: typeof (f.xSelected) === 'undefined' ? false : f.xSelected
          });
          this.selectY.addOption({
            label: f.label,
            value: f.value,
            selected: typeof (f.ySelected) === 'undefined' ? false : f.ySelected
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