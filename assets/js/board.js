// Board related functions
Kanboard.Board = (function() {

    var checkInterval = null;

    function on_popover(e)
    {
        Kanboard.Popover(e, Kanboard.Init);
    }

    // Setup the board
    function board_load_events()
    {
        // Drag and drop
        $(".column").sortable({
            delay: 300,
            distance: 5,
            connectWith: ".column",
            placeholder: "draggable-placeholder",
            stop: function(event, ui) {
                board_save(
                    ui.item.attr('data-task-id'),
                    ui.item.parent().attr("data-column-id"),
                    ui.item.index() + 1,
                    ui.item.parent().attr('data-swimlane-id')
                );
            }
        });

        // Assignee change
        $(".assignee-popover").click(Kanboard.Popover);

        // Category change
        $(".category-popover").click(Kanboard.Popover);

        // Task edit popover
        $(".task-edit-popover").click(on_popover);
        $(".task-creation-popover").click(on_popover);

        // Description popover
        $(".task-description-popover").click(on_popover);

        // Tooltips
        $(".task-board-tooltip").tooltip({
            track: false,
            position: {
                my: 'left-20 top',
                at: 'center bottom+9',
                using: function(position, feedback) {

                    $(this).css(position);

                    var arrow_pos = feedback.target.left + feedback.target.width / 2 - feedback.element.left - 20;

                    $("<div>")
                        .addClass("tooltip-arrow")
                        .addClass(feedback.vertical)
                        .addClass(arrow_pos == 0 ? "align-left" : "align-right")
                        .appendTo(this);
                }
            },
            content: function(e) {
                var href = $(this).attr('data-href');

                if (! href) {
                    return;
                }

                var _this = this;
                $.get(href, function setTooltipContent(data) {

                    $('.ui-tooltip-content:visible').html(data);

                    var tooltip = $('.ui-tooltip:visible');

                    // Clear previous position, it interferes with the updated position computation
                    tooltip.css({ top: '', left: '' });

                    // Remove arrow, it will be added when repositionning
                    tooltip.children('.tooltip-arrow').remove();

                    // Reposition the tooltip
                    var position = $(_this).tooltip("option", "position");
                    position.of = $(_this);
                    tooltip.position(position);

                    // Toggle subtasks status
                    $('#tooltip-subtasks a').click(function(e) {

                        e.preventDefault();
                        e.stopPropagation();

                        $.get($(this).attr('href'), setTooltipContent);
                    });
                });

                return '<i class="fa fa-refresh fa-spin fa-2x"></i>';
            }
        }).on("mouseenter", function() {

            var _this = this;
            $(this).tooltip("open");

            $(".ui-tooltip").on("mouseleave", function () {
                $(_this).tooltip('close');
            });

        }).on("mouseleave focusout", function (e) {

            e.stopImmediatePropagation();
            var _this = this;

            setTimeout(function () {
                if (! $(".ui-tooltip:hover").length) {
                    $(_this).tooltip("close");
                }
            }, 100);
        });

        // Redirect to the task details page
        $("[data-task-url]").each(function() {
            $(this).click(function() {
                window.location = $(this).attr("data-task-url");
            });
        });

        // Automatic refresh
        var interval = parseInt($("#board").attr("data-check-interval"));

        if (interval > 0) {
            checkInterval = window.setInterval(board_check, interval * 1000);
        }
    }

    // Stop events
    function board_unload_events()
    {
        $("[data-task-url]").off();
        clearInterval(checkInterval);
    }

    // Save and refresh the board
    function board_save(taskId, columnId, position, swimlaneId)
    {
        board_unload_events();

        $.ajax({
            cache: false,
            url: $("#board").attr("data-save-url"),
            contentType: "application/json",
            type: "POST",
            processData: false,
            data: JSON.stringify({
                "task_id": taskId,
                "column_id": columnId,
                "swimlane_id": swimlaneId,
                "position": position
            }),
            success: function(data) {
                $("#board").remove();
                $("#main").append(data);
                board_load_events();
                filter_apply();
            }
        });
    }

    // Check if a board have been changed by someone else
    function board_check()
    {
        if (Kanboard.IsVisible()) {
            $.ajax({
                cache: false,
                url: $("#board").attr("data-check-url"),
                statusCode: {
                    200: function(data) {
                        $("#board").remove();
                        $("#main").append(data);
                        board_unload_events();
                        board_load_events();
                        filter_apply();
                    }
                }
            });
        }
    }

    // Apply user or date filter (change tasks opacity)
    function filter_apply()
    {
        var selectedUserId = $("#form-user_id").val();
        var selectedCategoryId = $("#form-category_id").val();
        var filterDueDate = $("#filter-due-date").hasClass("filter-on");

        $("[data-task-id]").each(function(index, item) {

            var ownerId = item.getAttribute("data-owner-id");
            var dueDate = item.getAttribute("data-due-date");
            var categoryId = item.getAttribute("data-category-id");

            if (ownerId != selectedUserId && selectedUserId != -1) {
                item.style.opacity = "0.2";
            }
            else {
                item.style.opacity = "1.0";
            }

            if (filterDueDate && (dueDate == "" || dueDate == "0")) {
                item.style.opacity = "0.2";
            }

            if (categoryId != selectedCategoryId && selectedCategoryId != -1) {
                item.style.opacity = "0.2";
            }
        });
        
		// Save filter settings for active project to localStorage
		if (typeof(Storage) !== "undefined") {
		    var projectId = $('#board').data('project-id');
			localStorage.setItem("filters_" + projectId + "_form-user_id", selectedUserId);
			localStorage.setItem("filters_" + projectId + "_form-category_id", selectedCategoryId);
			localStorage.setItem("filters_" + projectId + "_filter-due-date", ~~(filterDueDate));
		}
    }

    // Load filter events
    function filter_load_events()
    {
        $("#form-user_id").change(filter_apply);

        $("#form-category_id").change(filter_apply);

        $("#filter-due-date").click(function(e) {
            $(this).toggleClass("filter-on");
            filter_apply();
            e.preventDefault();
        });
        
		// Get and set filters from localStorage for active project
		if (typeof(Storage) !== "undefined") {
		    var projectId = $('#board').data('project-id');

			$("#form-user_id").val(localStorage.getItem("filters_" + projectId + "_form-user_id") || -1);
			$("#form-category_id").val(localStorage.getItem("filters_" + projectId + "_form-category_id") || -1);
			
			if (+localStorage.getItem("filters_" + projectId + "_filter-due-date")) {
				$("#filter-due-date").addClass("filter-on");
			} else {
				$("#filter-due-date").removeClass("filter-on");
			}
			
	    	filter_apply();
		}
    }

    return {
        Init: function() {
            board_load_events();
            filter_load_events();
        }
    };

})();
