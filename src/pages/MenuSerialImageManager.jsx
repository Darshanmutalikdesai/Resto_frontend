import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Search, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../lib/apiClient";
import { getMenuSerialMapApi, updateMenuItemImageApi } from "../lib/api/menuApi";

export default function MenuSerialImageManager() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [photos, setPhotos] = useState({});
  const [fileNames, setFileNames] = useState({});
  const [search, setSearch] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getMenuSerialMapApi()
      .then((menuItems) => {
        if (!isMounted) return;
        setItems(menuItems);
        setPhotos(Object.fromEntries(menuItems.map((item) => [item.serialNumber, item.imageUrl])));
      })
      .catch((requestError) => {
        if (isMounted) setError(getApiErrorMessage(requestError, "Unable to load the serial menu."));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || `${item.serialNumber} ${item.name} ${item.category}`.toLowerCase().includes(query);
      const hasPhoto = Boolean(photos[item.serialNumber]);
      return matchesSearch && (!showMissingOnly || !hasPhoto);
    });
  }, [items, photos, search, showMissingOnly]);

  const missingCount = items.filter((item) => !photos[item.serialNumber]).length;

  const choosePhoto = (item, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((current) => ({ ...current, [item.serialNumber]: reader.result }));
      setFileNames((current) => ({ ...current, [item.serialNumber]: file.name }));
      setSavedId(null);
    };
    reader.readAsDataURL(file);
  };

  const savePhoto = async (item) => {
    const imageUrl = photos[item.serialNumber]?.trim();
    if (!imageUrl) {
      setError(`Choose a photo or add an image URL for ${item.name} first.`);
      return;
    }

    setSavingId(item.id);
    setSavedId(null);
    setError("");
    try {
      await updateMenuItemImageApi(item.id, imageUrl);
      setItems((current) => current.map((entry) => entry.serialNumber === item.serialNumber ? { ...entry, imageUrl } : entry));
      setSavedId(item.serialNumber);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to save the photo for ${item.name}.`));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4efe7] px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <ArrowLeft size={18} /> Back
        </button>

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Menu management</p>
            <h1 className="text-3xl font-bold text-slate-900">Add menu photos</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">Use the serial number to find each dish and attach the photo that should appear on the menu.</p>
            <p className="mt-2 text-xs font-semibold text-orange-700">{missingCount} of {items.length} items still need a photo.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm sm:w-80">
              <Search size={18} className="text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial number or dish" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={showMissingOnly} onChange={(event) => setShowMissingOnly(event.target.checked)} />
              Show items needing photos only
            </label>
          </div>
        </div>

        {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        {loading && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading serial menu...</p>}
        {!loading && !filteredItems.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No menu items found.</p>}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <article key={`${item.serialNumber}-${item.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative flex h-52 items-center justify-center overflow-hidden bg-slate-100">
                {photos[item.serialNumber] ? <img src={photos[item.serialNumber]} alt={item.name} className="h-full w-full object-cover" /> : <ImagePlus size={36} className="text-slate-300" />}
                <span className="absolute left-3 top-3 rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-bold text-white">#{item.serialNumber}</span>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.category}</p>
                <h2 className="mt-1 truncate font-bold text-slate-900" title={item.name}>{item.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{item.price ? `₹${item.price}` : "Price not provided"}</p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-300 px-3 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50">
                  <Upload size={15} /> {fileNames[item.serialNumber] || "Choose photo from device"}
                  <input type="file" accept="image/*" onChange={(event) => choosePhoto(item, event)} className="sr-only" />
                </label>
                <div className="mt-3 flex gap-2">
                  <input type="url" value={photos[item.serialNumber] || ""} onChange={(event) => { setPhotos((current) => ({ ...current, [item.serialNumber]: event.target.value })); setFileNames((current) => ({ ...current, [item.serialNumber]: "" })); }} placeholder="Or paste image URL" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-600" />
                  <button type="button" onClick={() => savePhoto(item)} disabled={savingId === item.serialNumber} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                    {savingId === item.serialNumber ? <LoaderCircle size={15} className="animate-spin" /> : savedId === item.serialNumber ? <Check size={15} /> : <ImagePlus size={15} />}
                    {savedId === item.serialNumber ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}