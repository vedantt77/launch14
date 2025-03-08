import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Launch } from '../types/launch';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Single cache object to store both launches and upvotes
const cache = {
  launches: null as { data: Launch[]; timestamp: number } | null,
  upvotes: {} as {
    [key: string]: {
      upvotes: number;
      upvotedBy: string[];
      timestamp: number;
    };
  }
};

// Function to get all launches with caching
export async function getLaunches(): Promise<Launch[]> {
  const now = Date.now();

  // Return cached data if it's still valid
  if (cache.launches && (now - cache.launches.timestamp) < CACHE_DURATION) {
    return cache.launches.data;
  }

  try {
    // Get approved startups from Firestore in a single query
    const startupsRef = collection(db, 'startups');
    const q = query(startupsRef, where('status', '==', 'approved'));
    const querySnapshot = await getDocs(q);
    
    const approvedLaunches: Launch[] = [];
    
    // Get current week's start and end dates
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    querySnapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const launchDate = data.scheduledLaunchDate.toDate();
      
      // Only include launches that are:
      // 1. Premium or Boosted listings (always show these)
      // 2. Regular listings from the current week
      if (data.listingType === 'premium' || 
          data.listingType === 'boosted' ||
          (launchDate >= startOfWeek && launchDate <= endOfWeek)) {
        approvedLaunches.push({
          id: docSnapshot.id,
          name: data.name,
          logo: data.logoUrl,
          description: data.description,
          launchDate: data.scheduledLaunchDate.toDate().toISOString(),
          website: data.url,
          category: data.category || 'New Launch',
          listingType: data.listingType || 'regular',
          doFollowBacklink: true,
          upvotes: data.upvotes || 0,
          upvotedBy: data.upvotedBy || []
        });
      }
    });

    // Cache the results
    cache.launches = {
      data: approvedLaunches,
      timestamp: now
    };

    return approvedLaunches;
  } catch (error) {
    console.error('Error fetching launches:', error);
    // Return cached data if available, otherwise return empty array
    return cache.launches?.data || [];
  }
}

// Function to get weekly launches (uses cached data)
export async function getWeeklyLaunches(): Promise<Launch[]> {
  const launches = await getLaunches();
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return launches.filter(launch => {
    const launchDate = new Date(launch.launchDate);
    return launchDate >= startOfWeek && launchDate <= endOfWeek;
  });
}

// Function to clear cache (useful for testing or forced updates)
export function clearLaunchesCache() {
  cache.launches = null;
  cache.upvotes = {};
}
