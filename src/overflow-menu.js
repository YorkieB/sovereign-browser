(function () {
	// [SovereignBrowser] Overflow menu. The buttons inside are the original
	// elements moved from the toolbar, so all existing listeners still apply.
	// Rows forward clicks to their button; the buttons themselves have
	// pointer-events disabled so a click cannot register twice.
	var btn = document.getElementById("btn-overflow");
	var menu = document.getElementById("overflow-menu");
	if (!btn || !menu) { return; }

	function close() {
		menu.classList.remove("open");
		btn.setAttribute("aria-expanded", "false");
	}

	btn.addEventListener("click", function (e) {
		e.stopPropagation();
		var open = menu.classList.toggle("open");
		btn.setAttribute("aria-expanded", open ? "true" : "false");
	});

	menu.querySelectorAll(".ovf-row").forEach(function (row) {
		row.addEventListener("click", function (e) {
			e.stopPropagation();
			var target = row.querySelector("button");
			if (target) {
				// [SovereignBrowser] data-action items are handled ONLY by the
				// delegated dispatcher, which never receives the event because the
				// row's stopPropagation() halts bubbling. Call the dispatcher
				// directly for them. Buttons with their own listeners (Split view,
				// tab groups, DevTools, Keychain, Settings, Voice) still get .click().
				var action = target.getAttribute("data-action");
				if (action && typeof globalThis.handleMenuAction === "function") {
					globalThis.handleMenuAction(action);
				} else {
					target.click();
				}
			}
			close();
		});
	});

	document.addEventListener("click", function (e) {
		if (!menu.contains(e.target) && e.target !== btn) { close(); }
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") { close(); }
	});
	window.addEventListener("blur", close);
})();