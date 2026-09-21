def capture():
    return {'sourceUrl': 'https://rdr2map.com/', 'window': {'mapData': {
        'map': {'id': 1}, 'groups': [{'id': 2, 'title': 'Collectibles'}],
        'categories': {'36': {'id': 36, 'title': 'Cards', 'icon': 'card', 'group_id': 2}}
    }}, 'sprite': {'card': {'x': 0, 'y': 0, 'width': 2, 'height': 2}},
        'responses': [{'url': 'https://media.mapgenie.io/v2/assets/prod/games/rdr2/markers/markers.png?v=1'}],
        'locations': {'locations': [
            {'id': 100, 'category_id': 36, 'title': 'None', 'latitude': 60, 'longitude': -20, 'media': [], 'icon': '/not-a-photo.png'},
            {'id': 101, 'category_id': 36, 'title': 'Gallery', 'latitude': 61, 'longitude': -21, 'media': [
                {'id': 10, 'type': 'image', 'url': '/first.jpg', 'order': 10, 'attribution': 'Author'},
                {'id': 11, 'type': 'image', 'url': '/second.jpg', 'order': 10}]},
            {'id': 102, 'category_id': 36, 'title': 'Unknown', 'latitude': 62, 'longitude': -22}
        ]}}
