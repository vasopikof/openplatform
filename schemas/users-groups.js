NEWSCHEMA('Users/Groups', function(schema) {

	schema.define('id', 'String(50)');
	schema.define('name', 'String(50)');
	schema.define('note', 'String(200)');
	schema.define('apps', '[Object]'); // [{ id: UID, roles: [] }]

	schema.setQuery(function($) {

		if ($.controller && FUNC.notadmin($))
			return;

		var arr = [];

		for (var i = 0; i < MAIN.groups.length; i++) {
			var group = MAIN.groups[i];
			var obj = {};
			obj.id = group.id;
			obj.name = group.name;
			obj.dtcreated = group.dtcreated;
			obj.dtupdated = group.dtupdated;
			obj.note = group.note;
			obj.apps = [];

			for (var j = 0; j < group.apps.length; j++) {
				var appid = group.apps[j];
				obj.apps.push({ id: appid, roles: group.appsroles[appid] || EMPTYARRAY });
			}

			arr.push(obj);
		}

		$.callback(arr);
	});

	schema.setPatch(function($) {

		if ($.controller && FUNC.notadmin($))
			return;

		var model = $.clean();
		var id = model.id || UID();
		var insert = false;
		var apps = model.apps;

		model.id = undefined;
		model.apps = undefined;
		model.dtupdated = NOW;

		var db = DBMS();

		db.upd('tbl_group', model, true).where('id', id).insert(function(doc) {
			doc.dtcreated = NOW;
			doc.dtupdated = undefined;
			doc.id = id;
			insert = true;
		});

		if (apps) {
			if (!insert)
				db.remove('tbl_group_app').where('groupid', id);

			for (var i = 0; i < apps.length; i++) {
				var appmeta = apps[i];
				if (appmeta == null || !appmeta.id)
					continue;
				var appid = appmeta.id;
				var app = MAIN.apps.findItem('id', appmeta.id);
				if (app)
					db.insert('tbl_group_app', { id: id + appid, groupid: id, appid: appid, roles: appmeta.roles });
			}
		}

		db.callback(function() {
			FUNC.refreshgroupsroles(function() {
				FUNC.refreshmeta($.done(id));
				EMIT('groups/' + (insert ? 'create' : 'udpate'), id);
				FUNC.log('groups/' + (insert ? 'create' : 'update'), id, model.name, $);
			});
		});
	});

	schema.setRemove(function($) {
		if ($.controller && FUNC.notadmin($))
			return;

		var id = $.query.id;
		var group = MAIN.groupscache[id];
		if (group == null) {
			$.error.replace('@', id);
			$.invalid('error-users-group');
			return;
		}

		var pgid = PG_ESCAPE(id);
		var db = DBMS();
		db.remove('tbl_group').query('id=' + pgid);
		db.query('UPDATE tbl_user SET dtmodified=NOW, dtupdated=NOW(), groups=array_remove(groups,{0}) WHERE ({0}=ANY(groups))'.format(pgid));
		db.callback(function() {
			FUNC.log('groups/remove', id, group.name, $);
			FUNC.refreshgroupsroles(function() {
				FUNC.refreshmeta($.done());
				EMIT('groups/remove', id);
			});
		});
	});

});