export async function NavBar() {
    return {
      name: 'NavBar',
      props: {
        currentPage: {
          required: true
        }
      },
      template: await fetch("./nav-bar.html").then((r) => r.text()),
    };
  }