// profile.js
import { NavBar } from "./nav-bar.js";
import { createApp, defineAsyncComponent } from "vue";
export async function Profile() {
  return {
    name: "Profile",
    data() {
      return {
        user: {
          name: "", pronouns: "", bio: "", status: "", interests: "", isPublic: true,
        },
        originalUser: null,
        editMode:false,
        loading:  true,
        hasProfile:  false,
      };
    },
    components: { 
        NavBar: defineAsyncComponent(NavBar),
     },
    mounted() {
      if (this.$graffitiSession.value) this.loadProfile();
      this.$watch(
        () => this.$graffitiSession.value,
        (newSess) => { if (newSess) {this.loadProfile();}
        else if (!newSess) { this.$router.push('/'); }}
      );
    },
    methods: {
      async loadProfile() {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          if (!session) {
            console.error("No Graffiti session available");
            return;
          }

          const actor = await session.actor;
          const schema = {
            type: "object",
            properties: {
              value: {
                type: "object",
                properties: { describes: { const: actor } },
                required: ["describes"],
              },
            },
          };

          const objs = [];
          for await (const { object } of this.$graffiti.discover([actor], schema, session)) {
            objs.push(object);
          }
          if (objs.length) {
            const latest = objs.sort(
              (a, b) =>
                (b.value.published || b.published) -
                (a.value.published || a.published)
            )[0];
            this.user = { ...latest.value };
            this.originalUser = JSON.parse(JSON.stringify(this.user));
            this.hasProfile   = true;
          }
        } catch (err) {
          console.error("Error loading profile:", err);
        } finally {
          this.loading = false;
        }
      },

      async saveProfile() {
        this.loading = true;
        try {
          const session = this.$graffitiSession.value;
          if (!session) throw new Error("Not logged in");

          const actor = await session.actor;
          const vals = {
            name:this.user.name,
            pronouns: this.user.pronouns,
            bio: this.user.bio,
            status: this.user.status,
            describes: actor,
            published: Date.now(),
            generator: "https://drewgeoly.github.io/designhw11/",
          };
          const profileObj = {
            value: vals,
            channels: [actor, "designftw-2025-studio2"],     // store on your personal channel
            allowed:  [],
          };

          await this.$graffiti.put(profileObj, session);

          this.originalUser = JSON.parse(JSON.stringify(this.user));
          this.hasProfile  = true;
          this.editMode = false;
          alert("Profile saved successfully!");
        } finally {
          this.loading = false;
        }
      },

      cancelEdit() {
        if (this.originalUser) {
          this.user = JSON.parse(JSON.stringify(this.originalUser));
        }
        if (this.hasProfile) {
          this.editMode = false;
        }
      },
    },
    template: await fetch("./profile.html").then(r => r.text()),
  };
}
