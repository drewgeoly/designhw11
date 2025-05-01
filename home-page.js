export async function HomePage() {
  return {
    methods: {
      async login() {
        const id = prompt("Enter a username for your session:");
        if (!id) return;
        await this.$graffiti.login(id);        // now $graffitiSession.value will be set
      },
    },
    template: await fetch("./home-page.html").then(r => r.text()),
  };
}
