import React from "@modules/react";
import SettingsTitle from "@ui/settings/title";
import {SettingsTitleContext} from "@ui/settings";

export default function AboutPanel() {
    const set = React.useContext(SettingsTitleContext);

    // Inject title for the About panel
    set(React.createElement(SettingsTitle, {text: 'About'}));

    return (
        <div style={{padding: 16}}>
            <h1 style={{margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--interactive-muted)'}}>
                In-Accord - About - © 2025/2026.
            </h1>
            <div style={{marginTop: 12, color: 'var(--text-normal)'}}>This is In-Accord. Version: 0.0.1</div>
        </div>
    );
}
