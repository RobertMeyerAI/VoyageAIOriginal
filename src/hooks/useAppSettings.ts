
'use client';

import { useEffect, useState } from "react";
import { getDBSettingsForUser } from "@/services/firestore";
import { useAuth } from "@/hooks/useAuth";
import { defaultSettings, type AppSettings } from "@/lib/settings-types";

export function useAppSettings() {
    const { userEmail } = useAuth();
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  
    useEffect(() => {
      if (userEmail) {
        getDBSettingsForUser(userEmail).then(dbSettings => {
            setSettings(dbSettings);
        }).catch(() => {
            setSettings(defaultSettings);
        });
      } else {
        setSettings(defaultSettings);
      }
    }, [userEmail]);
  
    return [settings] as const;
}
