import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { Upload, Copy, ExternalLink as External, QrCode, Share2, Images, Camera, Trash2, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ---------- Types ----------
type Img = { id: string; name: string; url: string; lastModified: number };
type Tote = { id: string; title: string; notes: string; images: Img[]; updatedAt: string };

// ---------- Utils ----------
const randId = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

const LS_PREFIX_TOTE = "taptote_tote_"; // + id
const LS_KEY_SETTINGS = "taptote_settings_v1";

function readToteLocal(id: string): Tote | null {
  try {
    return JSON.parse(localStorage.getItem(LS_PREFIX_TOTE + id) || "null");
  } catch {
    return null;
  }
}
function writeToteLocal(tote: Tote) {
  localStorage.setItem(LS_PREFIX_TOTE + tote.id, JSON.stringify(tote));
}
function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function setQueryParam(key: string, val: string | null) {
  const url = new URL(window.location.href);
  if (val == null) url.searchParams.delete(key);
  else url.searchParams.set(key, String(val));
  window.history.replaceState({}, "", url);
}
function useQueryParam(key: string) {
  const [value, setValue] = useState<string | null>(() => new URLSearchParams(window.location.search).get(key));
  useEffect(() => {
    const handler = () => setValue(new URLSearchParams(window.location.search).get(key));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [key]);
  return value;
}

// ---------- Component ----------
export default function App() {
  const toteId = useQueryParam("tote") || "";
  const [tote, setTote] = useState<Tote | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY_SETTINGS) || "{}");
      return !!s.cloudEnabled;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify({ cloudEnabled }));
  }, [cloudEnabled]);

  // Load or create tote tied to ?tote=
  useEffect(() => {
    if (!toteId) return;
    const existing = readToteLocal(toteId);
    if (existing) setTote(existing);
    else {
      const t: Tote = { id: toteId, title: `Tote ${toteId}`, notes: "", images: [], updatedAt: nowIso() };
      setTote(t);
      writeToteLocal(t);
    }
  }, [toteId]);

  const updateTote = (patch: Partial<Tote>) => {
    if (!tote) return;
    const next: Tote = { ...tote, ...patch, updatedAt: nowIso() };
    setTote(next);
    writeToteLocal(next);
  };

  const createNewTote = () => {
    const id = randId();
    setQueryParam("tote", id);
    const t: Tote = { id, title: `Tote ${id}`, notes: "", images: [], updatedAt: nowIso() };
    setTote(t);
    writeToteLocal(t);
  };

  const pageUrl = useMemo(() => {
    const url = new URL(window.location.href);
    if (tote?.id) url.searchParams.set("tote", tote.id);
    return url.toString();
  }, [tote]);

  // Image handlers
  const uploadImage = async (file: File) => {
    const dataUrl = await readFileAsDataURL(file);
    const image: Img = { id: randId(), name: file.name, url: dataUrl, lastModified: file.lastModified || Date.now() };
    updateTote({ images: [...(tote?.images || []), image] });
  };
  const removeImage = (id: string) => {
    if (!tote) return;
    updateTote({ images: tote.images.filter((i) => i.id !== id) });
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((f) => uploadImage(f));
  };
  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => uploadImage(f));
    e.currentTarget.value = "";
  };
  const openCameraUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // @ts-ignore capture is valid on mobile browsers
    input.capture = "environment";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) uploadImage(f);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <header className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">TapTote</h1>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <QrCode className="w-4 h-4" /> NFC / QR
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Tag this tote</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-600">
                      Write this URL to your NFC tag as an NDEF URL record, or print the QR below.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={pageUrl} />
                      <Button variant="secondary" size="sm" onClick={() => copyToClipboard(pageUrl)} className="gap-1">
                        <Copy className="w-4 h-4" /> Copy
                      </Button>
                      <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex">
                        <Button size="sm" className="gap-1">
                          <External className="w-4 h-4" /> Open
                        </Button>
                      </a>
                    </div>
                    <div className="flex justify-center py-3">
                      <QRCodeCanvas value={pageUrl} size={192} includeMargin />
                    </div>
                    <div className="rounded-md bg-blue-50 text-blue-900 p-3 text-sm flex gap-2">
                      <Info className="w-4 h-4 mt-0.5" />
                      Use the NFC Tools app → Write → URL → paste the link. Tap to program the tag.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={createNewTote} className="gap-1">
                <Share2 className="w-4 h-4" /> New Tote
              </Button>
            </div>
          </header>

          <Tabs defaultValue="tote">
            <TabsList>
              <TabsTrigger value="tote">Tote</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="tote" className="mt-4">
              {!tote ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Get started</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p>Create your first tote page. It will get a unique link you can put on an NFC tag.</p>
                    <Button onClick={createNewTote}>Create Tote</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-3 gap-4 items-start">
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Input value={tote.title} onChange={(e) => updateTote({ title: e.target.value })} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        className="border border-dashed rounded-xl p-6 text-center"
                      >
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <Images className="w-5 h-5" />
                          <div className="font-medium">Photos</div>
                        </div>
                        <p className="text-sm text-neutral-600 mb-3">Drag & drop or upload images.</p>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <Input type="file" accept="image/*" multiple onChange={onPick} className="hidden" />
                          <Button variant="secondary" className="gap-1">
                            <Upload className="w-4 h-4" /> Upload
                          </Button>
                          <Button variant="outline" className="gap-1" onClick={openCameraUpload}>
                            <Camera className="w-4 h-4" /> Camera
                          </Button>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-5">
                          {tote.images.map((img) => (
                            <div key={img.id} className="relative group">
                              <img src={img.url} alt={img.name} className="w-full h-28 object-cover rounded-lg shadow" />
                              <button
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
                                onClick={() => removeImage(img.id)}
                                title="Remove"
                              >
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 shadow">
                                  <Trash2 className="w-4 h-4" />
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={tote.notes}
                          onChange={(e) => updateTote({ notes: e.target.value })}
                          placeholder="Add/edit description…"
                        />
                      </div>

                      <div className="text-xs text-neutral-500 mt-2">
                        Last updated: {new Date(tote.updatedAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Share</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Link</Label>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={pageUrl} />
                          <Button variant="secondary" size="sm" onClick={() => copyToClipboard(pageUrl)} className="gap-1">
                            <Copy className="w-4 h-4" /> Copy
                          </Button>
                          <a href={pageUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" className="gap-1">
                              <External className="w-4 h-4" /> Open
                            </Button>
                          </a>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>QR</Label>
                        <div className="border rounded-lg p-3 flex justify-center">
                          <QRCodeCanvas value={pageUrl} size={144} includeMargin />
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-neutral-600">
                        <div>• Write this link to an NFC tag (NDEF URL).</div>
                        <div>• Stick the tag on the tote. Tap to open.</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Cloud Sync (placeholder)</div>
                      <div className="text-sm text-neutral-600">
                        Offline by default. Enable later when we add Firebase.
                      </div>
                    </div>
                    <Switch checked={cloudEnabled} onCheckedChange={setCloudEnabled as any} />
                  </div>
                  <div className="rounded-md bg-amber-50 text-amber-900 p-3 text-sm flex gap-2">
                    <Info className="w-4 h-4 mt-0.5" />
                    Everything is saved locally on this device (localStorage). Use the link/QR to reopen this tote page.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}