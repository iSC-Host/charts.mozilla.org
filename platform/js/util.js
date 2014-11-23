
importScript("../modevlib/util/CNV.js");
importScript("../modevlib/qb/Qb.js");
importScript("../modevlib/charts/aColor.js");

var NORMAL="#888888";
var NORMAL_HOVER=Color.newHTML(NORMAL).lighter().toHTML();
var SELECTED=Color.BLUE.hue(60).multiply(0.6).toHTML();
var SELECTED_HOVER = Color.BLUE.hue(60).multiply(0.6).lighter().toHTML();

function refresher(func){
	function callMe(){
		try{
			func()
		}catch(e){

		}
	}//method
	setInterval(callMe, 5*60*1000);
}


function sidebarSlider() {
	$("body").css("display", "block");

	$('.sidebar_name').click(function () {
		var self = $(this);
		if (self.hasClass("selected")) {
			self.removeClass("selected");
			$("#sidebar").animate({"width": "0px"}, 500);
			$(".content").animate({"margin-left":"60px"}, 500);  //TODO:
		} else {
			self.addClass("selected");
			$("#sidebar").animate({"width": "300px"}, 500);
			$(".content").animate({"margin-left":"360px"}, 500);
		}//endif
	});
}

function addRowClickers(){
	$(".bug_line").click(function(){
		var self = $(this);
		var link = Bugzilla.searchBugsURL(self[0].id);
		if (!link) return;
		window.open(link);
	});
}

function addTileClickers() {
	$(".project").hover(function(){
		var bugList ="#"+CNV.JSON2Object($(this).attr("bugsList")).join(",#");
		$(bugList).addClass("selected");

	}, function(){
		var bugList ="#"+CNV.JSON2Object($(this).attr("bugsList")).join(",#");
		$(bugList).removeClass("selected");
	}).click(function (e){
		var bugList = $(".selected.project").map(function(){
			return CNV.JSON2Object($(this).attr("bugsList"));
		}).get();
		if (bugList.length==0){
			$(".bug_line").removeClass("selected").slideDown(300, "swing");
		}else{
			bugList = "#"+bugList.join(",#");
			$(bugList).removeClass("selected").slideDown(1000, "swing");
			$(".bug_line").not(bugList).slideUp(1000, "swing");
		}//endif
	});
}//function


function tile(info){
	var normalColor = nvl(info.style.color, NORMAL);
	var hoverColor = Color.newInstance(normalColor).lighter().toHTML();

	info.bugsList = CNV.Object2JSON(info.bugs.select("bug_id"));
	info.bugsURL = Bugzilla.searchBugsURL(info.bugs.select("bug_id"));
	info.unassignedBugs = info.bugs.filter(function(b){
		return b.assigned_to == "nobody@mozilla.org"
	}).select("bug_id");
	info.unassignedURL = Bugzilla.searchBugsURL(info.unassignedBugs);
	info.color = normalColor;
	info.states = ["normal", "selected"];
	info.dynamicStyle={
		":hover": {"background-color": hoverColor},
		".selected": {"background-color": SELECTED},
		".selected:hover": {"background-color": SELECTED_HOVER}
	};

	var TEMPLATE = new Template([
		'<div class="project"  style="background-color:{{color}}" dynamic-style="{{dynamicStyle|css}}" dynamic-state="{{states|attribute}}" href="{{bugsURL}}" bugsList="{{bugsList}}">' ,
		'<div class="release">{{name}}</div>',
		'<div class="count">{{bugs.length}}</div>',
		(info.unassignedBugs.length > 0 ? '<div class="unassigned"><a class="count_unassigned" href="{{unassignedURL}}">{{unassignedBugs.length}}</a></div>' : '') ,
		'</div>'
	]);
	return TEMPLATE.replace(info);
}//function



//START COUNTING AT 1 (BECAUSE PRIORITY STARTS AT 1
//IT IS IMPORTANT FOR THE sorttable LIB THAT ALL ROWS HAVE A VALUE,
//AND IT IS IMPORTANT THAT THE NULLS ARE SORTED TO THE BOTTOM
function getPartIndex(b, domain){
	var parts = nvl(domain.partitions, domain.edges);
	for (var i=0;i<parts.length;i++){
		var part = parts[i];
		var result = [b].filter(part.esfilter);
		if (result.length>0){
			if (!Map.get(part, "style.color")) return {"style":{}, "order": i+1};

			return {
				"style":{
					"color":"transparent",
					"background-color":Map.get(part, "style.color")
				},
				"order": i+1
			};
		}//endif
	}//for
	return {"style":{"color":"transparent"}, "order": parts.length+1};
}//function


//1 IS POSITIVE INDICATION (MATCHES FILTER)
//2 IS NEGATIVE INDICATION
//IT IS IMPORTANT THAT THE NULLS ARE SORTED TO THE BOTTOM
//IT IS IMPORTANT FOR THE sorttable LIB THAT ALL ROWS HAVE A VALUE
function match(b, part){
	var result = [b].filter(part.esfilter);
	if (result.length==0) return {"style":{"color":"transparent"}, "order": 2};
	if (!Map.get(part, "style.color")) return {"style":{}, "order": 1};

	return {
		"style":{
			"color":"transparent",
			"background-color":Map.get(part, "style.color")
		},
		"order": 1
	};
}//function


var replacement={
	"javascript: ":"",
	"javascript engine:": "engine:",
	"javascript ": ""
};

function cleanupComponent(name){
	Map.forall(replacement, function(find, replace){
		name=name.replaceAll(find, replace);
	});
	return name;
}

function bugDetails(bugs) {

	var desk = Mozilla.Platform["Release Tracking - Desktop"];
	var b2g =Mozilla.Platform["Release Tracking - FirefoxOS"];
	bugs.forall(function(b){
		b.component = cleanupComponent(b.component);
		b.bugLink = Bugzilla.linkToBug(b.bug_id);
		b.priority = getPartIndex(b, Mozilla.Platform.Priority);
		b.security = getPartIndex(b, Mozilla.Platform.Security);
		b.stability =  match(b, Mozilla.Platform.Stability);
		b.release = match(b, desk.Release);
		b.beta = match(b, desk.Beta);
		b.dev = match(b, desk.Dev);
		b.nightly = match(b, desk.Nightly);
		b.b2g21 = match(b, b2g["2.1"]);
		b.b2g22 = match(b, b2g["2.2"]);
		b.assigned_to = b.assigned_to=="nobody@mozilla.org" ? "" : b.assigned_to;
		b.overallPriority = -3/ b.release.order-2/ b.beta.order-1/ b.dev.order -2/ b.security.order- 1/ b.priority.order-2/ b.stability.order;
	});

	bugs = Qb.sort(bugs, ["release.order", "overallPriority"]);

	var output = new Template([
		"<table class='table' style='width:auto'>",
		"<thead><tr>",
		"<th><div style='width:70px;'>ID</div></th>",
		"<th><div>Summary</div></th>",
		'<th><div>Component</div></th>',
		'<th><span>Owner</span></th>',
		'<th><span class="indicator">Security</span></th>',
		'<th><span class="indicator">Stability</span></th>',
		'<th><span class="indicator">Release</span><span id="sorttable_sortfwdind">&#x25BE;</span></th>',
		'<th><span class="indicator">Beta</span></th>',
		'<th><span class="indicator">Dev</span></th>',
		'<th><span class="indicator">Nightly</span></th>',
		'<th><span class="indicator">2.1</span></th>',
		'<th><span class="indicator">2.2</span></th>',
		'<th><span class="indicator">Priority</span></th>',
		"</tr></thead>",
		"<tbody>",
		{
			"from":".",
			"template":[
				'<tr id="{{bug_id}}" class="bug_line hoverable">',
				"<td><div>{{bugLink}}</div></td>",
				"<td><div id='{{bug_id}}_desc' class='desc'>[screened]</div></td>" ,
				'<td><div class="bz_component">{{component|html}}</div></span></td>',
				'<td><div class="email">{{assigned_to|html}}</div></span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{security.style|style}}">{{security.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{stability.style|style}}">{{stability.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{release.style|style}}">{{release.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{beta.style|style}}">{{beta.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{dev.style|style}}">{{dev.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{nightly.style|style}}">{{nightly.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{b2g21.style|style}}">{{b2g21.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{b2g22.style|style}}">{{b2g22.order}}</span></td>',
				'<td style="vertical-align: middle"><span class="indicator" style="{{priority.style|style}}">{{priority.order}}</span></td>',
				"</tr>"
			]
		},
		"</tbody>",
		"</table>"
	]).expand(bugs);

	return output;
}


function getCategoryHTML(category, allBugs){
	var edges = nvl(category.edges, category.partitions);

	var html;

	if (edges==null){
		//CATEGORY WITH SINGLE TILE
		html = tile({
			"name": category.name,
			"bugs": allBugs.list.filter(category.esfilter),
			"style": nvl(category.style, {})
		});

	}else{
		var unionFilter = edges.select("esfilter");

		html = edges.map(function(e, i){
			var info = {
				"name": e.name,
				"bugs": allBugs.list.filter(e.fullFilter),
				"style": nvl(e.style, {})
			};
			return tile(info)
		}).join("");

		//ADD THE REMAINDER
		var info = {
			"name": "Other",
			"style": {},
			"bugs": allBugs.list.filter({"and":[category.esfilter, {"not": {"or": unionFilter}}]})
		};
		if (info.bugs.length > 0) {
			html += tile(info);
		}//endif
	}//endif

	return '<div style="padding-top: 10px"><h3 id="' + category.name + '_title">' + category.name + '</h3></div><div id="' + category.name + '_tiles" style="padding-left: 50px">' + html + '</div>';
}//function



function setReleaseHTML(data){
	//DEAR SELF:  PLEASE LEARN D3!!
	//

	var header = "<td></td>"+data.edges[1].domain.partitions.map(function(p, i){
		return '<td style="text-align: center; width:60px;"><div>'+ p.name+'</div></td>';
	}).join("");



	var releaseTemplate = new Template([
		'<td style="vertical-align:middle;text-align: center; width:60px;">',
		'<div style="{{style|style}}">',
		'<div style="padding-top:6px;">{{value}}</div>',
		'</div>',
		'</td>'
	]);
	var release = data.edges[1].domain.partitions.map(function(p, i){
		var style = {
			"width":"40px",
			"height":"40px",
			"color":"white",
			"vertical-align":"middle",
			"text-align": "center",
			"display":"inline-block",
			"background-color": data.edges[0].domain.partitions[0].style.color
		};
		if (data.cube[0][i]>0){
			return releaseTemplate.replace({"value":data.cube[0][i], "style":style});
		}else{
			return "<td></td>";
		}//endif

	}).join("");


	var betaTemplate = new Template([
		'<td style="vertical-align:bottom;text-align: center; width:60px;">',
		'<div style="{{style|style}}">',
		'<span>{{value}}</span>',
		'</div>',
		'</td>'
	]);
	var beta = data.edges[1].domain.partitions.map(function(p, i){
		var style = {
			"width":"40px",
			"height":(data.cube[1][i]*10)+"px",
			"color": data.cube[1][i]>1 ? "white" : "transparent",
			"text-align": "center",
			"align":"center",
			"display":"inline-block",
			"background-color": data.edges[0].domain.partitions[1].style.color
		};

		return betaTemplate.replace({"value":data.cube[1][i], "style":style});
	}).join("");

	var devTemplate = new Template([
		'<td style="width:60px;text-align: center;">',
		'<div style="{{style|style}}">',
		'<div style="vertical-align: bottom;">{{value}}</div>',
		'</div>',
		'</td>'
	]);
	var dev = data.edges[1].domain.partitions.map(function(p, i){
		var style = {
			"width":"40px",
			"height":(data.cube[2][i]*10)+"px",
			"color":data.cube[2][i]>1 ? "white" : "transparent",
			"vertical-align": "bottom",
			"text-align": "center",
			"display":"inline-block",
			"background-color": data.edges[0].domain.partitions[2].style.color
		};
		return devTemplate.replace({"value":data.cube[2][i], "style":style});
	}).join("");


	var esrTemplate = new Template([
		'<td style="vertical-align:middle;text-align: center; width:60px;">',
		'<div style="{{style|style}}">',
		'<div style="padding-top:6px;">{{value}}</div>',
		'</div>',
		'</td>'
	]);
	var esr = data.edges[1].domain.partitions.map(function(p, i){
		var style = {
			"width":"40px",
			"height":"40px",
			"color":"white",
			"vertical-align":"middle",
			"text-align": "center",
			"display":"inline-block",
			"background-color": data.edges[0].domain.partitions[3].style.color
		};
		if (data.cube[3][i]>0){
			return esrTemplate.replace({"value":data.cube[3][i], "style":style});
		}else{
			return "<td></td>";
		}//endif

	}).join("");




	$("#teams").html(
		'<table id="teamsTable">' +
		'<thead><tr>'+header+'</tr></thead>' +
		'<tbody>' +
			(aMath.SUM(data.cube[0])>0 ? '<tr><td class="train_title"><h3>Release</h3></td>'+release+'</tr>' : '') +
		'<tr><td class="train_title"><h3>Beta</h3></td>'+beta+'</tr>' +
		'<tr><td class="train_title"><h3>Aurora</h3></td>'+dev+'</tr>' +
			(aMath.SUM(data.cube[3])>0 ? '<tr><td class="train_title"><h3>ESR 31</h3></td>'+esr+'</tr>' : '') +
		'</tbody>' +
		'</table>'
	);


}//function

