import { Comment, CommentThead } from './comment';
import { Cache, decompress, decompressItems, formatPublishedAt, fromYoutubeSearch, getComments, getCommentThreads, removeCache } from './common-client';
import { Channel, ChannelFilter, HttpRequest, Item, ItemFilter, ListItem, ListResult, Playlist, PlaylistFilter, PlaylistVideo, SearchId, SearchSnippet, Video, VideoCategory, YoutubeListResult } from './models';
import { CommentOrder, VideoService } from './service';
import { formatThumbnail } from './youtube';

export class VideoClient implements VideoService {
  private channelCache: Cache<Channel>;
  private playlistCache: Cache<Playlist>;
  getCommentThreads?: (videoId: string, sort?: CommentOrder, max?: number, nextPageToken?: string) => Promise<ListResult<CommentThead>>;
  getComments?: (id: string, max?: number, nextPageToken?: string) => Promise<ListResult<Comment>>;
  constructor(private url: string, private httpRequest: HttpRequest, private maxChannel: number = 40, private maxPlaylist: number = 200, private key?: string) {
    this.channelCache = {};
    this.playlistCache = {};
    this.getCagetories = this.getCagetories.bind(this);
    this.getChannels = this.getChannels.bind(this);
    this.getChannel = this.getChannel.bind(this);
    this.getChannelPlaylists = this.getChannelPlaylists.bind(this);
    this.getPlaylists = this.getPlaylists.bind(this);
    this.getPlaylist = this.getPlaylist.bind(this);
    this.getPlaylistVideos = this.getPlaylistVideos.bind(this);
    this.getChannelVideos = this.getChannelVideos.bind(this);
    this.getPopularVideos = this.getPopularVideos.bind(this);
    this.getPopularVideosByRegion = this.getPopularVideosByRegion.bind(this);
    this.getPopularVideosByCategory = this.getPopularVideosByCategory.bind(this);
    this.getVideos = this.getVideos.bind(this);
    this.getVideo = this.getVideo.bind(this);
    this.search = this.search.bind(this);
    this.getRelatedVideos = this.getRelatedVideos.bind(this);
    this.searchVideos = this.searchVideos.bind(this);
    this.searchPlaylists = this.searchPlaylists.bind(this);
    this.searchChannels = this.searchChannels.bind(this);
    if (key && key.length > 0) {
      this.getCommentThreads = (videoId: string, sort?: CommentOrder, max?: number, nextPageToken?: string): Promise<ListResult<CommentThead>> => {
        return getCommentThreads(httpRequest, key, videoId, sort, max, nextPageToken);
      };
      this.getComments = (id: string, max?: number, nextPageToken?: string): Promise<ListResult<Comment>> => {
        return getComments(httpRequest, key, id, max, nextPageToken);
      };
    }
  }
  getCagetories(regionCode?: string): Promise<VideoCategory[]> {
    if (!regionCode) {
      regionCode = 'US';
    }
    const url = `${this.url}/category?regionCode=${regionCode}`;
    return this.httpRequest.get<VideoCategory[]>(url);
  }
  getChannels(ids: string[], fields?: string[]): Promise<Channel[]> {
    const url = `${this.url}/channels/list?id=${ids.join(',')}&fields=${fields}`;
    return this.httpRequest.get<Channel[]>(url).then(res => formatPublishedAt(res));
  }
  getChannel(id: string, fields?: string[]): Promise<Channel|null|undefined> {
    const c = this.channelCache[id];
    if (c) {
      return Promise.resolve(c.item);
    } else {
      const field = fields ? `?fields=${fields}` : '';
      const url = `${this.url}/channels/${id}${field}`;
      return this.httpRequest.get<Channel>(url).then(channel => {
        if (channel) {
          if (channel.publishedAt) {
            channel.publishedAt = new Date(channel.publishedAt);
          }
          this.channelCache[id] = {item: channel, timestamp: new Date()};
          removeCache(this.channelCache, this.maxChannel);
        }
        return channel;
      }).catch(err => {
        const data = (err &&  err.response) ? err.response : err;
        if (data && (data.status === 404 || data.status === 410)) {
          return null;
        }
        throw err;
      });
    }
  }
  getChannelPlaylists(channelId: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<Playlist>> {
    const maxResults = (max && max > 0 ? max : 50);
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/playlists?channelId=${channelId}&limit=${maxResults}${pageToken}${field}`;
    return this.httpRequest.get<ListResult<Playlist>>(url).then(res => {
      formatPublishedAt<Playlist>(res.list);
      const r: ListResult<Playlist> = {
        list: decompressItems(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  getPlaylists(ids: string[], fields?: string[]): Promise<Playlist[]> {
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/playlists/list?id=${ids.join(',')}${field}`;
    return this.httpRequest.get<Playlist[]>(url).then(res => formatPublishedAt(res));
  }
  getPlaylist(id: string, fields?: string[]): Promise<Playlist|null|undefined> {
    const c = this.playlistCache[id];
    if (c) {
      return Promise.resolve(c.item);
    } else {
      const field = fields ? `?fields=${fields}` : '';
      const url = `${this.url}/playlists/${id}${field}`;
      return this.httpRequest.get<Playlist>(url).then(playlist => {
        if (playlist) {
          if (playlist.publishedAt) {
            playlist.publishedAt = new Date(playlist.publishedAt);
          }
          this.playlistCache[id] = {item: playlist, timestamp: new Date()};
          removeCache(this.playlistCache, this.maxPlaylist);
        }
        return playlist;
      }).catch(err => {
        const data = (err &&  err.response) ? err.response : err;
        if (data && (data.status === 404 || data.status === 410)) {
          return null;
        }
        throw err;
      });
    }
  }
  getPlaylistVideos(playlistId: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<PlaylistVideo>> {
    const maxResults = (max && max > 0 ? max : 50);
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos?playlistId=${playlistId}&limit=${maxResults}${pageToken}${field}`;
    return this.httpRequest.get<ListResult<PlaylistVideo>>(url).then(res => {
      formatPublishedAt<PlaylistVideo>(res.list);
      const r: ListResult<PlaylistVideo> = {
        list: decompress(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  getChannelVideos(channelId: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<PlaylistVideo>> {
    const maxResults = (max && max > 0 ? max : 50);
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos?channelId=${channelId}&limit=${maxResults}${pageToken}${field}`;
    return this.httpRequest.get<ListResult<PlaylistVideo>>(url).then(res => {
      formatPublishedAt<PlaylistVideo>(res.list);
      const r: ListResult<PlaylistVideo> = {
        list: decompress(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  getPopularVideos(regionCode?: string, videoCategoryId?: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<Video>> {
    if ((!regionCode || regionCode.length === 0) && (!videoCategoryId || videoCategoryId.length === 0)) {
      regionCode = 'US';
    }
    const regionParam = regionCode && regionCode.length > 0 ? `&regionCode=${regionCode}` : '';
    const categoryParam = videoCategoryId && videoCategoryId.length > 0 ? `&categoryId=${videoCategoryId}` : '';
    const maxResults = (max && max > 0 ? max : 50);
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos/popular?limit=${maxResults}${pageToken}${regionParam}${categoryParam}${field}`;
    return this.httpRequest.get<ListResult<Video>>(url).then(res => {
      formatPublishedAt<Video>(res.list);
      const r: ListResult<Video> = {
        list: decompress(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  getPopularVideosByRegion(regionCode?: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<Video>> {
    return this.getPopularVideos(regionCode, undefined, max, nextPageToken, fields);
  }
  getPopularVideosByCategory(videoCategoryId?: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<Video>> {
    return this.getPopularVideos(undefined, videoCategoryId, max, nextPageToken, fields);
  }
  getVideos(ids: string[], fields?: string[], noSnippet?: boolean): Promise<Video[]> {
    if (!ids || ids.length === 0) {
      return Promise.resolve([]);
    }
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos/list?id=${ids.join(',')}${field}`;
    return this.httpRequest.get<Video[]>(url).then(res => formatPublishedAt(res));
  }
  getRelatedVideos(videoId: string, max?: number, nextPageToken?: string, fields?: string[]): Promise<ListResult<Item>> {
    if (!videoId || videoId.length === 0) {
      const r: ListResult<Item> = {list: []};
      return Promise.resolve(r);
    }
    const maxResults = (max && max > 0 ? max : 50);
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos/${videoId}/related?limit=${maxResults}${pageToken}${field}`;
    return this.httpRequest.get<ListResult<Item>>(url).then(res => {
      formatPublishedAt<Item>(res.list);
      const r: ListResult<Item> = {
        list: decompress(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  getVideo(id: string, fields?: string[], noSnippet?: boolean): Promise<Video|null|undefined> {
    const field = fields ? `?fields=${fields}` : '';
    const url = `${this.url}/videos/${id}${field}`;
    return this.httpRequest.get<Video>(url).then(video => {
      if (video && video.publishedAt) {
        video.publishedAt = new Date(video.publishedAt);
      }
      return video;
    }).catch(err => {
      const data = (err &&  err.response) ? err.response : err;
      if (data && (data.status === 404 || data.status === 410)) {
        return null;
      }
      throw err;
    });
  }
  search(sm: ItemFilter, max?: number, nextPageToken?: string|number): Promise<ListResult<Item>> {
    const searchType = sm.type ? `&type=${sm.type}` : '';
    const searchDuration = sm.type === 'video' && (sm.duration === 'long' || sm.duration === 'medium' || sm.duration === 'short') ? `&videoDuration=${sm.duration}` : '';
    const searchOrder = (sm.sort === 'date' || sm.sort === 'rating' || sm.sort === 'title' || sm.sort === 'count' || sm.sort === 'viewCount' ) ? `&sort=${sm.sort}` : '';
    const regionParam = (sm.regionCode && sm.regionCode.length > 0 ? `&regionCode=${sm.regionCode}` : '');
    const pageToken = (nextPageToken ? `&pageToken=${nextPageToken}` : '');
    const maxResults = (max && max > 0 ? max : 50); // maximum is 50
    const url = `https://www.googleapis.com/youtube/v3/search?key=${this.key}&part=snippet${regionParam}&q=${sm.q}&maxResults=${maxResults}${searchType}${searchDuration}${searchOrder}${pageToken}`;
    return this.httpRequest.get<YoutubeListResult<ListItem<SearchId, SearchSnippet, any>>>(url).then(res => {
      const r = fromYoutubeSearch(res);
      r.list = formatThumbnail(r.list);
      return r;
    });
  }
  searchVideos(sm: ItemFilter, max?: number, nextPageToken?: string|number, fields?: string[]): Promise<ListResult<Item>> {
    const searchDuration = sm.type === 'video' && (sm.duration === 'long' || sm.duration === 'medium' || sm.duration === 'short') ? `&videoDuration=${sm.duration}` : '';
    const searchOrder = (sm.sort === 'date' || sm.sort === 'rating' || sm.sort === 'title' || sm.sort === 'count' || sm.sort === 'viewCount' ) ? `&sort=${sm.sort}` : '';
    const regionParam = (sm.regionCode && sm.regionCode.length > 0 ? `&regionCode=${sm.regionCode}` : '');
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const maxResults = (max && max > 0 ? max : 50); // maximum is 50
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/videos/search?q=${sm.q}${searchDuration}${regionParam}${searchOrder}${pageToken}${field}&limit=${maxResults}`;
    return this.httpRequest.get<ListResult<Item>>(url).then(res => {
      formatPublishedAt<Item>(res.list);
      const r: ListResult<Item> = {
        list: decompress(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  searchPlaylists(sm: PlaylistFilter, max?: number, nextPageToken?: string|number, fields?: string[]): Promise<ListResult<Playlist>> {
    const searchOrder = (sm.sort === 'date' || sm.sort === 'rating' || sm.sort === 'title' || sm.sort === 'count' || sm.sort === 'viewCount' ) ? `&sort=${sm.sort}` : '';
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const maxResults = (max && max > 0 ? max : 50); // maximum is 50
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/playlists/search?q=${sm.q}${searchOrder}${pageToken}${field}&limit=${maxResults}`;
    return this.httpRequest.get<ListResult<Playlist>>(url).then(res => {
      formatPublishedAt<Playlist>(res.list);
      const r: ListResult<Playlist> = {
        list: decompressItems(res.list),
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
  searchChannels(sm: ChannelFilter, max?: number, nextPageToken?: string|number, fields?: string[]): Promise<ListResult<Channel>> {
    const searchOrder = (sm.sort === 'date' || sm.sort === 'rating' || sm.sort === 'title' || sm.sort === 'count' || sm.sort === 'viewCount' ) ? `&sort=${sm.sort}` : '';
    const pageToken = (nextPageToken ? `&nextPageToken=${nextPageToken}` : '');
    const maxResults = (max && max > 0 ? max : 50); // maximum is 50
    const field = fields ? `&fields=${fields}` : '';
    const url = `${this.url}/channels/search?q=${sm.q}${searchOrder}${pageToken}${field}&limit=${maxResults}`;
    return this.httpRequest.get<ListResult<Channel>>(url).then(res => {
      formatPublishedAt<Channel>(res.list);
      const r: ListResult<Channel> = {
        list: res.list,
        nextPageToken: res.nextPageToken,
      };
      return r;
    });
  }
}
