function CSVEscape(item: string) {
    let stgItem = '';
    if (typeof item === 'object') {
        if (item === null) {
            stgItem = 'null';
        } else {
            stgItem = JSON.stringify(item);
        }
    } else {
        stgItem = item.toString();
    }
    let needEscape = false;
    if (stgItem.indexOf('\n') !== -1 || stgItem.indexOf(',') !== -1) {
        needEscape = true;
    }
    if (stgItem.indexOf('"') !== -1) {
        stgItem = stgItem.replace(/"/g, '""')
        needEscape = true;
    }
    if (needEscape) {
        return `"${stgItem}"`
    } else {
        return stgItem
    }
}

export function CSVFormatter(json: any[]) {
    const keys = Object.keys(json[0]);
    const csv = [keys.join(',')];
    json.forEach((row) => {
        const values = keys.map((key) => {
            return CSVEscape(row[key]);
        });
        csv.push(values.join(','));
    });
    return csv.join('\n');
}