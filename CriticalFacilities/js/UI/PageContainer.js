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
  'dojo/topic',
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
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
    topic,
    Evented,
    query,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    template,
    ViewStack) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,
      selected: '',
      tabs: null,
      average: false,
      nls: null,

      'baseClass': 'jimu-tab3',
      declaredClass: 'PageContainer', //TODO need to seperate from this

      //TODO...needs an internal approach to handle theme and color changes without the user needing to do anything
      // actually...can I just listen to the theme and color changes like the widgets do
      // that way the dijit could emit an event that views could just respond to and do their thing

      //TODO Previn asked about supporting a breadcrumb


      _currentIndex: -1,
      _homeIndex: 0,
      _rootIndex: 0,
      theme: '',
      isDarkTheme: '',
      styleColor: '',

      //requires an instance of the appConfig

      //public methods:
      //selectView
      //getSelectedIndex
      //getViewByIndex
      //getViewByTitle
      //addView
      //addViewAtIndex
      //removeViewByTitle
      //removeView
      //removeViewByIndex

      //events:
      //view-changed
      //view-added
      //view-removed
      //theme-change
      //layout-change
      //style-change
      //widget-change
      //map-change

      //css classes:
      //control-node
      //control-table
      //container-node
      //tab-shelter
      //page-item-td-left
      //page-item-td-right
      //page-item-div
      //main-text
      //margin-right-5
      //margin-left-5
      //float-right
      //float-left
      //bg-back-img
      //bg-back-img-white
      //bg-home
      //bg-home-img
      //bg-home-img-white
      //bg-next-img
      //bg-next-img-white
      //bg-img


      //Use this when jimu dijit
      //postMixInProperties: function () {
      //  this.nls = window.jimuNls.pageContainer;
      //},
      //get nls from here for now
      constructor: function (options) {
        lang.mixin(this, options);

        //get the theme from appConfig so we can handle black/white image toggle
        this.theme = this.appConfig.theme.name;

        //subscribe to appConfigChange to know when to update local resources like images
        topic.subscribe("appConfigChanged", lang.hitch(this, this._onAppConfigChanged));
      },

      postCreate: function () {
        this.inherited(arguments);
        this._initSelf();
        if (this.selected) {
          this.selectView(this.selected);
        } else if (this.views.length > 0) {
          this._homeView();
        }

        //use white images when in these themes...need a way to check if Dashboard is in light theme
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;
      },

      _onAppConfigChanged: function (appConfig, reason, changedData) {
        switch (reason) {
          case 'themeChange':
            this.theme = appConfig.theme.name;
            this.updateImageNodes();
            this._updateViewTheme();
            this.emit('theme-change', appConfig, reason, changedData);
            break;
          case 'layoutChange':
            this.emit('layout-change', appConfig, reason, changedData);
            break;
          case 'styleChange':
            this.emit('style-change', appConfig, reason, changedData);
            break;
          case 'widgetChange':
            this.emit('widget-change', appConfig, reason, changedData);
            break;
          case 'mapChange':
            this.emit('map-change', appConfig, reason, changedData);
            break;
        }
      },

      selectView: function (index) {
        this.viewStack.switchView(index);

        this._updateControl(this.backTd,
          index === this._homeIndex ? true : index + 1 === this.views.length ? false : false);
        this._updateControl(this.homeTd,
          index === this._homeIndex ? true : index + 1 === this.views.length ? false : false);
        this._updateControl(this.nextTd,
          index === this._homeIndex ? false : index + 1 === this.views.length ? true : false);

        this._currentIndex = index;

        this.emit('view-changed', index);
      },

      showShelter: function () {
        html.setStyle(this.shelter, 'display', 'block');
      },

      hideShelter: function () {
        html.setStyle(this.shelter, 'display', 'none');
      },

      _initSelf: function () {
        this.viewStack = new ViewStack(null, this.containerNode);
        this._initViews();
      },

      _initViews: function () {
        this.viewCount = this.views.length;
        for (var i = 0; i < this.views.length; i++) {
          var view = this.views[i];
          view.pageContainer = this;
          view.index = i;
          this.viewStack.addView(view);
          this.emit('viewadded', view);
        }
      },

      _prevView: function () {
        if ((this._currentIndex - 1) <= this._homeIndex) {
          this._homeView();
        } else {
          this._currentIndex -= 1;
          this.selectView(this._currentIndex);
        }
      },

      _homeView: function () {
        this._currentIndex = this._homeIndex;
        this.selectView(this._currentIndex);
      },

      _nextView: function () {
        if (this._currentIndex < this.viewCount -1) {
          this._currentIndex += 1;
          this.selectView(this._currentIndex);
        }
      },

      getSelectedIndex: function () {
        return this._currentIndex;
      },

      getSelectedTitle: function () {
        return this.viewStack.getSelectedLabel();
      },

      getViewByIndex: function (idx) {
        return this.views.filter(function (view) {
          return view.index === idx;
        });
      },

      getViewByTitle: function (title) {
        return this.views.filter(function (view) {
          return view.label === title;
        });
      },

      _updateControl: function (node, disable) {
        if (disable) {
          html.addClass(node, 'control-disbaled');
        } else {
          html.removeClass(node, 'control-disbaled');
        }
      },

      _updateViews: function () {
        this.viewCount = this.views.length;
        for (var i = 0; i < this.views.length; i++) {
          view.index = i;
        }
      },

      addView: function (view) {
        //adds a new view to the viewstack
        this.viewStack.addView(view);
        this._updateViews();
        this.emit('viewadded', view);
      },

      addViewAtIndex: function (view, idx) {
        ////adds a new view to the viewstack at the user defined index
        //this.viewStack.addView(view);
        this.emit('view-added', view);
        this._updateViews();
      },

      removeViewByTitle: function (title) {
        var view = this.getViewByTitle(title);
        this.removeViewByIndex(view.index);
      },

      removeView: function (view) {
        this.removeViewByIndex(view.index);
      },

      removeViewByIndex: function (idx) {
        var view = this.getViewByIndex(idx);
        this.viewStack.removeView(view)
        this._updateViews();
        this.emit('view-removed', view);
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.styleColor = styleColor;
        }));
      },

      //updateImageNodes: function () {
      //  //TODO toggle white/black images
      //  array.forEach(this.views, lang.hitch(this, function (view) {
      //    view._updateImageNodes();
      //  }));
      //},

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        this._updateImageNode(isDark, 'bg-back-img', 'bg-back-img-white');
        this._updateImageNode(isDark, 'bg-home-img', 'bg-home-img-white');
        this._updateImageNode(isDark, 'bg-next-img', 'bg-next-img-white');
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

      _updateViewTheme: function (theme) {
        this.theme = theme;
        array.forEach(this.views, lang.hitch(this, function (view) {
          view.theme = theme;
        }));
      }

    });
  });