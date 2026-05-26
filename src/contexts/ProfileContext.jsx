import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getProfiles, createProfile, updateProfile } from '../firebase/firestore';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [activeLanguage, setActiveLanguage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setActiveProfile(null);
      setActiveLanguage(null);
      setLoading(false);
      return;
    }
    loadProfiles();
  }, [user]);

  async function loadProfiles() {
    setLoading(true);
    const profs = await getProfiles(user.uid);
    setProfiles(profs);
    // Restore last active profile from localStorage
    const savedId = localStorage.getItem(`linguame_profile_${user.uid}`);
    const saved = profs.find(p => p.id === savedId);
    const first = saved || profs[0] || null;
    setActiveProfile(first);
    if (first) {
      const langs = Object.keys(first.languages || {});
      const savedLang = localStorage.getItem(`linguame_lang_${user.uid}_${first.id}`);
      setActiveLanguage(savedLang && langs.includes(savedLang) ? savedLang : langs[0] || null);
    }
    setLoading(false);
  }

  function switchProfile(profile) {
    setActiveProfile(profile);
    localStorage.setItem(`linguame_profile_${user.uid}`, profile.id);
    const langs = Object.keys(profile.languages || {});
    const savedLang = localStorage.getItem(`linguame_lang_${user.uid}_${profile.id}`);
    const lang = savedLang && langs.includes(savedLang) ? savedLang : langs[0] || null;
    setActiveLanguage(lang);
  }

  function switchLanguage(lang) {
    setActiveLanguage(lang);
    if (activeProfile) {
      localStorage.setItem(`linguame_lang_${user.uid}_${activeProfile.id}`, lang);
    }
  }

  async function addProfile(profileData) {
    const id = await createProfile(user.uid, profileData);
    const newProfile = { id, ...profileData };
    setProfiles(prev => [...prev, newProfile]);
    return newProfile;
  }

  async function updateActiveProfile(data) {
    if (!activeProfile) return;
    await updateProfile(user.uid, activeProfile.id, data);
    const updated = { ...activeProfile, ...data };
    setActiveProfile(updated);
    setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  async function refreshProfiles() {
    await loadProfiles();
  }

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      activeLanguage,
      loading,
      switchProfile,
      switchLanguage,
      addProfile,
      updateActiveProfile,
      refreshProfiles,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
