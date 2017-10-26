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
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./FeatureList.html",
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
    template) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-feature-list',
      declaredClass: 'CriticalFacilities.FeatureList',
      templateString: template,
      _started: null,
      label: 'FeatureList',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      features: [],
      hint: "",
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      //TODO this has to respond to changes to feature state
      // for example if they locate it needs to be able to transition from the un-matched to matched list for example
      //In that case this list would need to remove the feature
      //may be wiser to use the store apporach...

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initFeatureList(this.features);
        this.pageHint.innerHTML = this.hint;
      },

      startup: function () {
        console.log('FeatureList startup');
      },

      onShown: function () {
        console.log('FeatureList shown');
      },

      _initFeatureList: function (features) {
        array.forEach(features, lang.hitch(this, function (f) {
          //construct the individual feature rows
          var tr = domConstruct.create('tr', {
            className: "control-row bottom-border"
          }, this.featureListTable);

          var tdLabel = domConstruct.create('td', {
            className: "pad-left-10 pad-right-10"
          }, tr);
          domConstruct.create('div', {
            className: "main-text float-left",
            innerHTML: f.label
          }, tdLabel);

          var tdArrow = domConstruct.create('td', {
            className: "width-15"
          }, tr);
          domConstruct.create('div', {
            className: "next-arrow"
          }, tdArrow);

          tr.fieldInfo = f.fieldInfo;
        }));

        //template rows
        //<tr class="control-row">
        //  <td class="pad-left-10 pad-right-10">
        //    <div class="main-text float-left" data-dojo-attach-point="lblY">TEST</div>
        //  </td>
        //  <td class="width-15">
        //    <div class="next-arrow"></div>
        //  </td>
        //</tr>
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