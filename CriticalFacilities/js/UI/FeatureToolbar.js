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
  'dojo/_base/html',
  'dojo/on',
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dojo/text!./templates/FeatureToolbar.html'
],
  function (declare,
    lang,
    array,
    html,
    on,
    Evented,
    query,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    template) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,

      'baseClass': 'cf-feature-toolbar',
      declaredClass: 'FeatureToolbar',
      label: "FeatureToolbar",

      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      feature: null,
      layer: null,
      theme: '',
      isDarkTheme: '',
      locators: [],
      styleColor: '',

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;
      },

      _edit: function () {
        alert('edit');
      },

      _locate: function () {
        alert('locate');
      },

      _save: function () {
        alert('save');
      },

      locateFeature: function (address) {
        //return feature from locationToAddress
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        this._updateImageNode(isDark, 'bg-edit', 'bg-edit-white');
        this._updateImageNode(isDark, 'bg-locate', 'bg-locate-white');
        this._updateImageNode(isDark, 'bg-save', 'bg-save-white');
      },

      _updateImageNode: function (isDark, img, imgWhite) {
        var removeClass = isDark ? img : imgWhite;
        var addClass = isDark ? imgWhite : img;
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }

    });
  });