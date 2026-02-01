import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showErrorMessage, showSuccessMessage, showLoadingIndicator, hideLoadingIndicator } from "../src/ui";

describe("UI functions", () => {
  beforeEach(() => {
    // DOM をクリア
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  describe("showLoadingIndicator", () => {
    it("should create loading indicator element", () => {
      showLoadingIndicator(1, 1);
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toContain("翻訳中");
    });

    it("should show batch progress when multiple batches", () => {
      showLoadingIndicator(3, 2);
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator?.textContent).toContain("2/3");
    });

    it("should reuse existing indicator", () => {
      showLoadingIndicator(1, 1);
      showLoadingIndicator(2, 1);
      
      const indicators = document.querySelectorAll("#translator-loading-indicator");
      expect(indicators.length).toBe(1);
    });
  });

  describe("hideLoadingIndicator", () => {
    it("should remove loading indicator", () => {
      showLoadingIndicator(1, 1);
      hideLoadingIndicator();
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator).toBeNull();
    });

    it("should not remove error indicator", () => {
      showErrorMessage("Test error");
      hideLoadingIndicator();
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator).not.toBeNull();
    });
  });

  describe("showErrorMessage", () => {
    it("should create error message element", () => {
      showErrorMessage("Test error", "Error details");
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator).not.toBeNull();
      expect(indicator?.classList.contains("error")).toBe(true);
      expect(indicator?.textContent).toContain("Test error");
      expect(indicator?.textContent).toContain("Error details");
    });

    it("should show warning icon", () => {
      showErrorMessage("Test error");
      
      const indicator = document.getElementById("translator-loading-indicator");
      expect(indicator?.textContent).toContain("⚠️");
    });
  });

  describe("showSuccessMessage", () => {
    it("should create success message element", () => {
      showSuccessMessage("Success!", "Details here");
      
      const toast = document.getElementById("translator-success-toast");
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toContain("Success!");
      expect(toast?.textContent).toContain("Details here");
    });

    it("should show checkmark icon", () => {
      showSuccessMessage("Success!");
      
      const toast = document.getElementById("translator-success-toast");
      expect(toast?.textContent).toContain("✓");
    });

    it("should remove existing toast before creating new one", () => {
      showSuccessMessage("First");
      showSuccessMessage("Second");
      
      const toasts = document.querySelectorAll("#translator-success-toast");
      expect(toasts.length).toBe(1);
      expect(toasts[0].textContent).toContain("Second");
    });
  });
});
