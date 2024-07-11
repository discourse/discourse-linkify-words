import { withPluginApi } from "discourse/lib/plugin-api";
import { readInputList, traverseNodes } from "../lib/utilities";

export default {
  name: "discourse-linkify-initializer",

  initialize() {
    withPluginApi("0.8.7", (api) => {
      // roughly guided by https://stackoverflow.com/questions/8949445/javascript-bookmarklet-to-replace-text-with-a-link
      let skipTags = {
        a: 1,
        iframe: 1,
      };

      settings.excluded_tags.split("|").forEach((tag) => {
        tag = tag.trim().toLowerCase();
        if (tag !== "") {
          skipTags[tag] = 1;
        }
      });

      let skipClasses = {};

      settings.excluded_classes.split("|").forEach((cls) => {
        cls = cls.trim().toLowerCase();
        if (cls !== "") {
          skipClasses[cls] = 1;
        }
      });

      let skipAttributes = {};

      settings.excluded_attributes.split("|").forEach((attr) => {
        attr = attr.trim().toLowerCase();
        if (attr !== "") {
          skipAttributes[attr] = 1;
        }
      });

      let createLink = function (text, url) {
        let link = document.createElement("a");
        link.innerHTML = text;
        link.href = url;
        link.rel = "nofollow";
        link.target = "_blank";
        link.className = "linkify-word no-track-link";
        return link;
      };

      let Action = function (inputListName, method) {
        this.inputListName = inputListName;
        this.createNode = method;
        this.inputs = {};
      };

      let linkify = new Action("linked_words", createLink);
      let actions = [linkify];
      actions.forEach(readInputList);

      api.decorateCookedElement(
        (element) => {
          actions.forEach((action) => {
            if (Object.keys(action.inputs).length > 0) {
              traverseNodes(element, action, skipTags, skipClasses, skipAttributes);
            }
          });
        },
        { id: "linkify-words-theme" }
      );
    });
  },
};
