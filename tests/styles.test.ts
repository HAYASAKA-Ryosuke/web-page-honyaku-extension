import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { injectLoadingStyles, injectTooltipStyles } from "../src/styles";

describe("Styles injection", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  describe("injectLoadingStyles", () => {
    it("should inject loading styles into head", () => {
      injectLoadingStyles();
      
      const style = document.getElementById("translator-loading-styles");
      expect(style).not.toBeNull();
      expect(style?.tagName).toBe("STYLE");
    });

    it("should not duplicate styles on multiple calls", () => {
      injectLoadingStyles();
      injectLoadingStyles();
      injectLoadingStyles();
      
      const styles = document.querySelectorAll("#translator-loading-styles");
      expect(styles.length).toBe(1);
    });

    it("should contain loading indicator styles", () => {
      injectLoadingStyles();
      
      const style = document.getElementById("translator-loading-styles");
      expect(style?.textContent).toContain(".translator-loading-indicator");
      expect(style?.textContent).toContain(".translator-loading-spinner");
    });

    it("should contain error state styles", () => {
      injectLoadingStyles();
      
      const style = document.getElementById("translator-loading-styles");
      expect(style?.textContent).toContain(".translator-loading-indicator.error");
    });

    it("should contain success state styles", () => {
      injectLoadingStyles();
      
      const style = document.getElementById("translator-loading-styles");
      expect(style?.textContent).toContain(".translator-loading-indicator.success");
    });
  });

  describe("injectTooltipStyles", () => {
    it("should inject tooltip styles into head", () => {
      injectTooltipStyles();
      
      const style = document.getElementById("translator-tooltip-styles");
      expect(style).not.toBeNull();
      expect(style?.tagName).toBe("STYLE");
    });

    it("should not duplicate styles on multiple calls", () => {
      injectTooltipStyles();
      injectTooltipStyles();
      injectTooltipStyles();
      
      const styles = document.querySelectorAll("#translator-tooltip-styles");
      expect(styles.length).toBe(1);
    });

    it("should contain tooltip display styles", () => {
      injectTooltipStyles();
      
      const style = document.getElementById("translator-tooltip-styles");
      expect(style?.textContent).toContain(".translator-original-display");
    });

    it("should contain position classes", () => {
      injectTooltipStyles();
      
      const style = document.getElementById("translator-tooltip-styles");
      expect(style?.textContent).toContain(".position-top");
      expect(style?.textContent).toContain(".position-bottom");
    });

    it("should contain pinned state styles", () => {
      injectTooltipStyles();
      
      const style = document.getElementById("translator-tooltip-styles");
      expect(style?.textContent).toContain(".translator-original-display.pinned");
    });
  });
});
