import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";

// create the Vue application instance
const app = createApp(App);

// use Pinia and Vue Router in the application
app.use(createPinia());
app.use(router);

app.mount("#app");
