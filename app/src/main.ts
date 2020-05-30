import Vue from "vue";
import App from "./App.vue";

import "./assets/styles/index.css";

// Font awesome icons
import { initIconLibrary } from "./plugins/icons";
initIconLibrary();

// Router
import router from "./plugins/router";

// Store
import store from "./store";

Vue.config.productionTip = false;

new Vue({
  render: h => h(App),
  router,
  store
}).$mount("#app");
