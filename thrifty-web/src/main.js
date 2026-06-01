import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";

// create the Vue application instance
// this is the main entry point of the application where we set up the Vue app, integrate Pinia for state management, and Vue Router for routing, and then mount the app to the DOM.
const app = createApp(App);

// use Pinia and Vue Router in the application
app.use(createPinia());
app.use(router);

// mount the application to the DOM element with id "app"
app.mount("#app");
