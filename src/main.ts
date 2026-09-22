import { mount } from "svelte";
import "./app.css";
import "./core/registry/builtins";
import App from "./ui/App.svelte";

const app = mount(App, { target: document.getElementById("app")! });
export default app;
