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
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  "dojo/text!./PageContainer.html",
  'jimu/dijit/ViewStack'
],
  function (declare,
    lang,
    array,
    html,
    on,
    Evented,
    query,
    _WidgetBase,
    _TemplatedMixin,
    template,
    ViewStack) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,
      selected: '',
      tabs: null,
      average: false,

      'baseClass': 'jimu-tab3',
      declaredClass: 'PageContainer',

      _currentIndex: -1,
      _homeIndex: 0,
      _rootIndex: 0,
      _selectedIndex: -1,

      //TODO should support a collection of collections of views
      //TODO could add optional breadcrumb??

      postCreate: function () {
        this.inherited(arguments);
        this._initSelf();
        if (this.selected) {
          this.selectTab(this.selected);
        } else if (this.views.length > 0) {
          this._homeView();
        }
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;
      },

      selectTab: function (index) {
        this.viewStack.switchView(index);

        this._updateControl(this.backTd,
          index === this._homeIndex ? true : index + 1 === this.views.length ? false : false);
        this._updateControl(this.homeTd,
          index === this._homeIndex ? true : index + 1 === this.views.length ? false : false);
        this._updateControl(this.nextTd,
          index === this._homeIndex ? false : index + 1 === this.views.length ? true : false);

        this.emit('tabChanged', index);
      },

      showShelter: function () {
        html.setStyle(this.shelter, 'display', 'block');
      },

      hideShelter: function () {
        html.setStyle(this.shelter, 'display', 'none');
      },

      getSelectedIndex: function () {
        return this._currentIndex;
      },

      getSelectedTitle: function () {
        return this.viewStack.getSelectedLabel();
      },

      _initSelf: function () {
        this.viewStack = new ViewStack(null, this.containerNode);
        this._initViews();
      },

      _initViews: function () {
        this.viewCount = this.views.length;
        array.forEach(this.views, lang.hitch(this, function (view) {
          this.viewStack.addView(view);
        }));
      },

      _onSelect: function (title) {
        this.selectTab(title);
      },

      _prevView: function () {
        if ((this._currentIndex - 1) <= this._homeIndex) {
          this._homeView();
        } else {
          this._currentIndex -= 1;
          this.selectTab(this._currentIndex);
        }
      },

      _homeView: function () {
        this._currentIndex = this._homeIndex;
        this.selectTab(this._currentIndex);
      },

      _nextView: function () {
        if (this._currentIndex < this.viewCount -1) {
          this._currentIndex += 1;
          this.selectTab(this._currentIndex);
        }
      },

      _getViewByIndex: function (idx) {
        return this.views.filter(function (view) {
          return view.index === idx;
        });
      },

      _updateControl: function (node, disable) {
        if (disable) {
          html.addClass(node, 'control-disbaled');
        } else {
          html.removeClass(node, 'control-disbaled');
        }
      }
    });
  });