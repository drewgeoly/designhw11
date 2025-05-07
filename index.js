import { createApp, defineAsyncComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { GraffitiRemote} from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

import { CommunitiesPage } from "./communities-pages.js";
import { HomePage } from "./home-page.js";
import { Profile } from "./profile.js";
import { MessagesPage } from "./messages-page.js";
import { MyRsvpsPage } from "./my-rsvps-page.js";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { 
      path: "/", 
      component: HomePage 
    },
    { 
      path: "/communities", 
      component: CommunitiesPage 
    },
    { 
      path: "/profile", 
      component: Profile 
    },
    {
      path: "/messages", 
      component: MessagesPage 
    },
    {
      path: "/my-rsvps", 
      component: MyRsvpsPage,
    },
  ],
});

createApp({
  components: {
    HomePage: defineAsyncComponent(() => import("./home-page.js")),
    CommunitiesPage: defineAsyncComponent(() => import("./communities-pages.js")),
    Profile: defineAsyncComponent(() => import("./profile.js")),
    MessagesPage: defineAsyncComponent(() => import("./messages-page.js")),
    MyRsvpsPage: defineAsyncComponent(() => import("./my-rsvps-page.js"))
  },
})
  .use(router)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiRemote({ }),
  })
  .mount("#app");
