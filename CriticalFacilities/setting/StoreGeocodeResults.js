///////////////////////////////////////////////////////////////////////////
// Copyright 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(['dojo/_base/declare',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/BaseWidget',
  'dojo/Evented',
  'dojo/_base/lang',
  'dojo/dom-construct',
  'dojo/text!./StoreGeocodeResults.html'
],
  function (declare, _WidgetsInTemplateMixin, BaseWidget, Evented, lang, domConstruct, template) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
      templateString: template,
      baseClass: 'jimu-widget-setting-critical-facilities',

      constructor: function (options) {
        this.nls = options.nls;
        this.url = options.url;
      },

      postMixInProperties: function(){
        this.inherited(arguments);
        this.nls = lang.mixin(this.nls, window.jimuNls.common);
        this.nls = lang.mixin(this.nls, window.jimuNls.basicServiceChooser);
      },

      postCreate: function () {
        this.inherited(arguments);

        if (this.url) {
          this._setTextValue(this.url);
        }
      },

      _onSetStoreUrlClick: function () {
        var url = this._getTextValue();
        //TODO add logic to see if we can write to this location
        alert(url);
      },

      _setTextValue: function (value) {
        this.storeUrl.set('value', value);
      },

      _getTextValue: function (td) {
        return this.storeUrl.get('value');
      },

      destroy: function () {

      }
    });
  });
