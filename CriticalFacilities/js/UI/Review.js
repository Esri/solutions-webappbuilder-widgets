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
  'dojo/dom-class',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./Review.html",
  'dojo/query'
],
  function (declare,
    lang,
    html,
    array,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    query) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-review',
      declaredClass: 'CriticalFacilities.Review',
      templateString: template,
      _started: null,
      label: 'Review',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      matchedList: [],
      unMatchedList: [],
      duplicateList: [],
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initReviewRows();
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        console.log('Review startup');
      },

      onShown: function () {
        console.log('Review shown');
      },

      _initReviewRows: function () {
        this._initReviewRow(this.matchedList,
          [this.matchedHintRow, this.matchedControlRow], this.matchedCount);
        this._initReviewRow(this.unMatchedList,
          [this.unMatchedHintRow, this.unMatchedControlRow], this.unMatchedCount);
        this._initReviewRow(this.duplicateList,
          [this.duplicateHintRow, this.duplicateControlRow], this.duplicateCount);
      },

      _initReviewRow: function (features, controlRows, countNode) {
        if (features.length > 0) {
          array.forEach(controlRows, function (r) {
            if (domClass.contains(r, 'display-none')) {
              domClass.remove(r, 'display-none');
            }
          });
          countNode.innerHTML = features.length;
        } else {
          array.forEach(controlRows, function (r) {
            if (!domClass.contains(r, 'display-none')){
              domClass.add(r, 'display-none');
            }
          });
        }
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var removeClass = isDark ? 'next-arrow-img' : 'next-arrow-img-white';
        var addClass = isDark ? 'next-arrow-img-white' : 'next-arrow-img';
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      _download: function () {
        //wire up csv Utils
      },

      _submit: function () {
        //submit to feature service
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateTheme: function (theme) {
        this.theme = theme;
      }

    });
  });